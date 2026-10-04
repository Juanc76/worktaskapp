package com.sed.background_geolocation;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;

import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.app.Notification;
import androidx.core.app.NotificationCompat;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.Binder;
import android.os.Build;
import android.os.IBinder;

import android.os.Handler;
import android.os.Looper;
import android.os.HandlerThread;
import android.os.Bundle;
import android.provider.Settings;
import com.getcapacitor.Logger;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationAvailability;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;

import java.util.Locale;
import java.util.Date;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.atomic.AtomicBoolean;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;
import android.os.PowerManager;
import org.json.JSONArray;
import org.json.JSONObject;


public class BackgroundGeolocationService extends Service {
    
    static final String ACTION_BROADCAST = (
            BackgroundGeolocationService.class.getPackage().getName() + ".broadcast"
    );
    private final LocalBinder binder = new LocalBinder();

    // Must be unique for this application.
    private static final int NOTIFICATION_ID = 28351;
    private static final long LIVE_SYNC_INTERVAL_MS = 60000L;
    private static final int LIVE_SYNC_LIMIT = 1;
    private static final String DEFAULT_LOCATION_SYNC_ENDPOINT = "https://admin.sedsap.com/seddbeapp/api/dbe/synApp/syncRegistroLocationRutaPME";
    private static final String DEFAULT_AUTH_REFRESH_ENDPOINT = "https://admin.sedsap.com/seddbeapp/api/auth/refresh";
    private static final String TRACKING_STATE_PREFERENCES = "PMETrackingNativeState";
    private static final String PREF_TRACKING_ACTIVE = "trackingActive";
    private static final String PREF_WATCHER_ID = "watcherId";
    private static final String PREF_ID_TRAZADO = "idTrazado";
    private static final String PREF_ID_USER = "idUser";
    private static final String PREF_DISTANCE_FILTER = "distanceFilter";
    private static final String PREF_TOTAL_DISTANCE = "totalDistance";
    private SQLiteDatabase db;
    private final SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault());
    private Location lastLocationForDistance = null;
    private double totalDistanceAccumulated = 0.0;

    private java.util.List<android.content.ContentValues> locationBuffer = new java.util.ArrayList<>();
    private static final int BATCH_SIZE = 10;
    private volatile boolean isFlushing = false; // El "Semáforo"
    private final Object lock = new Object();
    private PowerManager.WakeLock wakeLock;
    private HandlerThread locationThread;
    private Looper locationLooper;
    private HandlerThread liveSyncThread;
    private Handler liveSyncHandler;
    private Runnable liveSyncRunnable;
    private final AtomicBoolean isSyncingLiveLocation = new AtomicBoolean(false);
    private final Object liveSyncLock = new Object();
    private final Object tokenRefreshLock = new Object();
    private volatile boolean liveSyncEnabled = false;
    private volatile boolean restoredSessionAttempted = false;
    public static final String CHANNEL_ID = "tracking_channel";
   
    private class Watcher {
        public String id;
        public FusedLocationProviderClient client;
        public LocationRequest locationRequest;
        public LocationCallback locationCallback;
        public Notification backgroundNotification;
        public String idTrazado;
        public int idUser;
        public double initialDistance;
    }

    private final Set<Watcher> watchers = new CopyOnWriteArraySet<Watcher>();

    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    // La Idea es vaciar buffer hacia la base de datos y dejar el servicio activo asi se apague la pantalla
    @Override
    public boolean onUnbind(Intent intent) {
        android.util.Log.d("PME_NATIVO", "⚠️ Servicio desvinculado. Iniciando rescate de datos...");
        flushBufferToDBSync();
        // No removemos watchers al perder el bind; el servicio foreground debe
        // seguir reportando en segundo plano.
        return true;
    }

    @Override
    public void onRebind(Intent intent) {
        super.onRebind(intent);
        android.util.Log.d("PME_NATIVO", "🔁 Servicio re-vinculado");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
            
                Notification notification = createBaseNotification();

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
                } else {
                    startForeground(NOTIFICATION_ID, notification);
                }

                android.util.Log.d("PME_NATIVO", "🚀 Servicio en FOREGROUND con tipo LOCATION");

                restoreTrackingSessionIfNecessary();

                return START_STICKY;
    }

    private Notification createBaseNotification() {
                NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                        .setContentTitle("Tracking PME SED activo")
                        .setContentText("Registrando ubicación...")
                        .setSmallIcon(getApplicationInfo().icon)
                        .setOngoing(true)
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setCategory(NotificationCompat.CATEGORY_NAVIGATION)
                        .setOnlyAlertOnce(true)
                        .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);

                return builder.build();
    }

    @Override
    public void onCreate() {
            super.onCreate();

            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            wakeLock = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "PME::GeoTrackingLock"
            );
            wakeLock.acquire();

            android.util.Log.d("PME_NATIVO", "🔋 WakeLock adquirido");

            locationThread = new HandlerThread("LocationThread");
            locationThread.start();
            locationLooper = locationThread.getLooper();

            liveSyncThread = new HandlerThread("LiveLocationSyncThread");
            liveSyncThread.start();
            liveSyncHandler = new Handler(liveSyncThread.getLooper());
    }

    @Override
    public void onDestroy() {
        stopLiveLocationSync();
        try {
        flushBufferToDBSync();
        } catch (Exception e) {
            android.util.Log.e("PME_NATIVO", "Error en rescate final: " + e.getMessage());
        }
        
        for (Watcher watcher : watchers) {
        try {
            if (watcher.client != null && watcher.locationCallback != null) {
                watcher.client.removeLocationUpdates(watcher.locationCallback);
            }
        } catch (Exception e) {
            android.util.Log.e("PME_NATIVO", "Error removiendo updates en onDestroy: " + e.getMessage());
        }
        }
        
            try {
                stopForeground(true);
            } catch (Exception e) {
            // Silencioso si ya se había detenido
            }

        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            android.util.Log.d("PME_NATIVO", "🔋 WakeLock liberado");
        }
        if (locationThread != null) {
            locationThread.quitSafely();
            android.util.Log.d("PME_NATIVO", "🛑 LocationThread detenido");
        }
        if (liveSyncThread != null) {
            liveSyncThread.quitSafely();
            android.util.Log.d("PME_SYNC", "LiveLocationSyncThread detenido");
        }
         super.onDestroy();
    }

    Notification getNotification() {
        for (Watcher watcher : watchers) {
            if (watcher.backgroundNotification != null) {
                return watcher.backgroundNotification;
            }
        }
        return null;
    }

    public class LocalBinder extends Binder {
        void addWatcher(
                final String id,
                Notification backgroundNotification,
                float distanceFilter, String idTrazado, int idUser, double initialDistance
        ) {
            if (hasTrazadoId(idTrazado)) {
                removeExistingWatchersForTrazado(idTrazado, id);
            }

            FusedLocationProviderClient client = LocationServices.getFusedLocationProviderClient(
                    BackgroundGeolocationService.this
            );
            LocationRequest locationRequest = new LocationRequest();
            locationRequest.setInterval(5000);
            locationRequest.setFastestInterval(5000);
            locationRequest.setPriority(LocationRequest.PRIORITY_HIGH_ACCURACY);
            locationRequest.setSmallestDisplacement(distanceFilter);

            LocationCallback callback = new LocationCallback(){
                @Override
                public void onLocationResult(LocationResult locationResult) {
                 if (locationResult == null) return;
                     android.util.Log.e("PME_NATIVO", "Ingresando a onLocationResult, id: " + id);
                     Location location = locationResult.getLastLocation();
                    if (location == null) {
                    android.util.Log.e("PME_NATIVO", "⚠️ Ignorando ciclo: location es null");
                    return; 
                    }
                try {
                    if (location.getAccuracy() > 30){
                        android.util.Log.e("PME_NATIVO", "Accuracy muy elevado: " + location.getAccuracy());
                        return;
                    } 

                    double speedKmH = location.getSpeed() * 3.6;
                    double stepDistance = 0;
                    boolean huboMovimientoReal = false;

                        if (lastLocationForDistance != null) {
                            stepDistance = lastLocationForDistance.distanceTo(location);
                            if (stepDistance > 5.0 && speedKmH > 1.0) { // Filtro de movimiento real
                                totalDistanceAccumulated += stepDistance;
                                android.util.Log.e("PME_NATIVO", "Distancia aumento: " + stepDistance + " metros. Total acumulado: " + totalDistanceAccumulated + " metros.");
                                huboMovimientoReal = true;
                             }else {
                                huboMovimientoReal = false;
                                android.util.Log.e("PME_NATIVO", "Movimiento menor a 5 metros+ (" + stepDistance + ") o velocidad menor a 1.0 km/h (" + speedKmH + "), no se acumula distancia.");
                                return;
                             }
                        }else {
                            huboMovimientoReal = true; 
                        }
                        lastLocationForDistance = location;
                   if(huboMovimientoReal) {    
                        persistTotalDistance(totalDistanceAccumulated);
                        Intent intent = new Intent(ACTION_BROADCAST);
                        intent.putExtra("location", location);
                        intent.putExtra("id", id);
                        intent.putExtra("totalDistance", totalDistanceAccumulated);
                        LocalBroadcastManager.getInstance(
                                    getApplicationContext()
                            ).sendBroadcast(intent);
                            
                     if (hasTrazadoId(idTrazado)) {
                            android.content.ContentValues v = new android.content.ContentValues();
                             String fecha = sdf.format(new Date());
                            v.put("idRegistro", createNativeTrackingId());
                            v.put("idTrazado", idTrazado);
                            v.put("fechaGps", fecha);
                            v.put("latitud", location.getLatitude());
                            v.put("longitud", location.getLongitude());
                             android.util.Log.d("altitud", "Altitud: " + location.getAltitude());
                         
                            if (location.hasAltitude()) {
                            v.put("altitud", location.getAltitude());
                             } else {
                                v.putNull("altitud");
                            }
                            v.put("velocidad", location.getSpeed() * 3.6);
                            v.put("accuracy", location.getAccuracy());
                            v.put("procesado_ui", 0);
                            v.put("fechaRegistro", fecha);
                            v.put("syncedDB", 0);
                            if (idUser != -1) {
                            v.put("idUser", idUser);
                            }
                           synchronized(lock) {
                            locationBuffer.add(v);
                            android.util.Log.d("PME_NATIVO", "📍 Punto en buffer (" + locationBuffer.size() + "/" + BATCH_SIZE + ")");
                            if (locationBuffer.size() >= BATCH_SIZE && !isFlushing) {
                                flushBufferToDB();
                            }
                           }
                          } 
                         } 
                        } catch (Exception e) {
                           
                            android.util.Log.e("PME_NATIVO", "Error procesando ubicación: " + e.getMessage());
                             return;
                        } 
                                       
                }
                @Override
                public void onLocationAvailability(LocationAvailability availability) {
                    if (!availability.isLocationAvailable()) {
                        Logger.debug("Location not available desde onLocationAvailability");
                    }
                }
            };

            Watcher watcher = new Watcher();
            watcher.id = id;
            watcher.client = client;
            watcher.locationRequest = locationRequest;
            watcher.locationCallback = callback;
            watcher.backgroundNotification = backgroundNotification;
            watcher.idTrazado = idTrazado;
            watcher.idUser = idUser;
            watcher.initialDistance = initialDistance;
            watchers.add(watcher);

            if (hasTrazadoId(idTrazado)) {
                persistTrackingSession(id, idTrazado, idUser, distanceFilter, initialDistance);
            }
            
            totalDistanceAccumulated = initialDistance;
            lastLocationForDistance = null;
            if (hasTrazadoId(idTrazado)) {
                startLiveLocationSync();
            }
            
            try {
                watcher.client.requestLocationUpdates(
                        watcher.locationRequest,
                        watcher.locationCallback,
                        locationLooper
                );
            } catch (SecurityException ignore) {}

                        
            if (backgroundNotification != null) {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        startForeground(NOTIFICATION_ID, createBaseNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
                    } else {
                        startForeground(NOTIFICATION_ID, createBaseNotification());
                    }
                } catch (Exception exception) {
                    Logger.error("Failed to foreground service", exception);
                }
            }  
        }

       void removeWatcher(String id) {
           Watcher found = null;
           for (Watcher watcher : watchers) {
               if (watcher.id.equals(id)) {
                   found = watcher;
                   watchers.remove(watcher);
                   break;
               }
           }

           if (found != null) {
               try {
                   flushBufferToDBSync();
               } catch (Exception e) {
                   android.util.Log.e("PME_NATIVO", "Error en flush durante removeWatcher: " + e.getMessage());
               }
               try {
                   found.client.removeLocationUpdates(found.locationCallback);
               } catch (Exception e) {
                   android.util.Log.e("PME_NATIVO", "Error removiendo location updates: " + e.getMessage());
               }
           } else {
               android.util.Log.w("PME_NATIVO", "⚠️ removeWatcher: no se encontró watcher con id=" + id);
           }

           // Siempre verificar si ya no hay watchers para detener el servicio
           if (watchers.isEmpty()) {
                clearPersistedTrackingSession();
                stopLiveLocationSync();
               android.util.Log.d("PME_NATIVO", "🛑 No quedan watchers. Deteniendo servicio foreground.");
               try {
                   stopForeground(true);
               } catch (Exception e) {
                   android.util.Log.e("PME_NATIVO", "Error en stopForeground: " + e.getMessage());
               }
               stopSelf();
           }
        }


        void onPermissionsGranted() {
             // Si se otorgaron permisos mientras la aplicación estaba en segundo plano,
             // es necesario reiniciar los observadores.
            for (Watcher watcher : watchers) {
                watcher.client.removeLocationUpdates(watcher.locationCallback);
                watcher.client.requestLocationUpdates(
                        watcher.locationRequest,
                        watcher.locationCallback,
                        locationLooper
                );
            }
        }

        void stopService() {
            clearPersistedTrackingSession();
            BackgroundGeolocationService.this.stopSelf();
        }
    }

    private void removeExistingWatchersForTrazado(String idTrazado, String incomingWatcherId) {
        for (Watcher watcher : watchers) {
            if (idTrazado.equals(watcher.idTrazado) && !watcher.id.equals(incomingWatcherId)) {
                try {
                    watcher.client.removeLocationUpdates(watcher.locationCallback);
                } catch (Exception e) {
                    android.util.Log.w("PME_NATIVO", "No se pudo reemplazar watcher previo: " + e.getMessage());
                }
                watchers.remove(watcher);
                android.util.Log.d("PME_NATIVO", "Watcher nativo reemplazado para idTrazado=" + idTrazado);
            }
        }
    }

    private void persistTrackingSession(
            String watcherId,
            String idTrazado,
            int idUser,
            float distanceFilter,
            double totalDistance
    ) {
        getTrackingStatePreferences().edit()
                .putBoolean(PREF_TRACKING_ACTIVE, true)
                .putString(PREF_WATCHER_ID, watcherId)
                .putString(PREF_ID_TRAZADO, idTrazado)
                .putInt(PREF_ID_USER, idUser)
                .putFloat(PREF_DISTANCE_FILTER, distanceFilter)
                .putString(PREF_TOTAL_DISTANCE, Double.toString(totalDistance))
                .apply();
    }

    private void persistTotalDistance(double totalDistance) {
        SharedPreferences preferences = getTrackingStatePreferences();
        if (!preferences.getBoolean(PREF_TRACKING_ACTIVE, false)) return;
        preferences.edit()
                .putString(PREF_TOTAL_DISTANCE, Double.toString(totalDistance))
                .apply();
    }

    private void clearPersistedTrackingSession() {
        getTrackingStatePreferences().edit().clear().apply();
    }

    private SharedPreferences getTrackingStatePreferences() {
        return getApplicationContext().getSharedPreferences(TRACKING_STATE_PREFERENCES, MODE_PRIVATE);
    }

    private String getPersistedActiveTrazadoId() {
        SharedPreferences preferences = getTrackingStatePreferences();
        if (!preferences.getBoolean(PREF_TRACKING_ACTIVE, false)) return null;
        return getStringPreference(preferences, PREF_ID_TRAZADO);
    }

    private double getPersistedTotalDistance(SharedPreferences preferences) {
        try {
            return Double.parseDouble(preferences.getString(PREF_TOTAL_DISTANCE, "0"));
        } catch (Exception e) {
            return 0.0;
        }
    }

    private void restoreTrackingSessionIfNecessary() {
        if (restoredSessionAttempted || !watchers.isEmpty()) return;
        restoredSessionAttempted = true;

        SharedPreferences preferences = getTrackingStatePreferences();
        if (!preferences.getBoolean(PREF_TRACKING_ACTIVE, false)) return;

        String idTrazado = getStringPreference(preferences, PREF_ID_TRAZADO);
        if (!hasTrazadoId(idTrazado)) {
            clearPersistedTrackingSession();
            return;
        }

        String previousWatcherId = preferences.getString(PREF_WATCHER_ID, "unknown");
        String restoredWatcherId = "native-restored-" + idTrazado + "-" + previousWatcherId;
        int idUser = preferences.getInt(PREF_ID_USER, -1);
        float distanceFilter = preferences.getFloat(PREF_DISTANCE_FILTER, 0f);
        double totalDistance = getPersistedTotalDistance(preferences);

        android.util.Log.d("PME_NATIVO", "Restaurando tracking nativo para idTrazado=" + idTrazado);
        binder.addWatcher(
                restoredWatcherId,
                createBaseNotification(),
                distanceFilter,
                idTrazado,
                idUser,
                totalDistance
        );
    }

    private String getStringPreference(SharedPreferences preferences, String key) {
        Object value = preferences.getAll().get(key);
        return value == null ? null : String.valueOf(value);
    }

    private boolean hasTrazadoId(String idTrazado) {
        return idTrazado != null && idTrazado.trim().length() > 0;
    }

    private String createNativeTrackingId() {
        return System.currentTimeMillis() + "-" + UUID.randomUUID().toString();
    }

    private void flushBufferToDB() {
     isFlushing = true;
     final java.util.List<android.content.ContentValues> batchToSave;
     synchronized (lock) {
        // Clonamos el buffer y lo vaciamos inmediatamente
        batchToSave = new java.util.ArrayList<>(locationBuffer);
        locationBuffer.clear(); 
      }
    if (batchToSave.isEmpty()) {
        isFlushing = false;
        return;
    }


   new Thread(new Runnable() {
        @Override
        public void run() {
            try {
                if (db == null || !db.isOpen()) {
                    File dbFile = getApplicationContext().getDatabasePath("appRecognition_dbSQLite.db");
                    if (dbFile.exists()) {
                        db = SQLiteDatabase.openDatabase(dbFile.getAbsolutePath(), null, SQLiteDatabase.OPEN_READWRITE);
                    }
                }

                if (db != null && db.isOpen()) {
                    db.beginTransaction();
                    try {
                        for (android.content.ContentValues values : batchToSave) {
                            db.insertOrThrow("APPD_RegistroLocationRutaPME", null, values);
                        }
                        db.setTransactionSuccessful();
                        android.util.Log.d("PME_NATIVO", "💾 Lote de " + batchToSave.size() + " puntos guardado.");
                    } finally {
                        db.endTransaction();
                    }
                } else {
                    throw new IllegalStateException("Base de datos de tracking no disponible.");
                }
            } catch (Exception e) {
                android.util.Log.e("PME_NATIVO", "❌ Error en volcado: " + e.getMessage());
                synchronized (lock) {
                    locationBuffer.addAll(0, batchToSave);
                }
            } finally {
                isFlushing = false; // Liberamos el semáforo
            }
        }
    }).start();
}

private void flushBufferToDBSync() {
    synchronized (lock) {
        // Si el buffer está vacío, no hacemos nada
        if (locationBuffer.isEmpty()) return;

        try {
      
            if (db == null || !db.isOpen()) {
                File dbFile = getApplicationContext().getDatabasePath("appRecognition_dbSQLite.db");
                if (dbFile.exists()) {
                    db = SQLiteDatabase.openDatabase(dbFile.getAbsolutePath(), null, SQLiteDatabase.OPEN_READWRITE);
                }
            }

            if (db != null && db.isOpen()) {
                db.beginTransaction();
                try {
                    for (android.content.ContentValues values : locationBuffer) {
                        db.insertOrThrow("APPD_RegistroLocationRutaPME", null, values);
                    }
                    db.setTransactionSuccessful();
                    android.util.Log.d("PME_NATIVO", "🚨 FLUSH DE EMERGENCIA: " + locationBuffer.size() + " puntos rescatados.");
                    locationBuffer.clear(); 
                } finally {
                    db.endTransaction();
                }
            }
        } catch (Exception e) {
            android.util.Log.e("PME_NATIVO", "❌ ERROR EN RESCATE: " + e.getMessage());
        }
    }
}

// private void guardarUbicacionEnDB(android.content.Context context, Location loc, String idTrazado) {
//        try {

//         if (db == null || !db.isOpen()) {
//                 File dbFile = context.getDatabasePath("appRecognition_dbSQLite.db");

//                 if (dbFile.exists()) {
//                     db = SQLiteDatabase.openDatabase(
//                         dbFile.getAbsolutePath(),
//                         null,
//                         SQLiteDatabase.OPEN_READWRITE
//                     );
//                 } else {
//                      return;
//                 }
//             }

//         android.content.ContentValues v = new android.content.ContentValues();
//         v.put("idRegistro", createNativeTrackingId());
//         v.put("idTrazado", idTrazado);
//         v.put("latitud", loc.getLatitude());
//         v.put("longitud", loc.getLongitude());
//         if (loc.hasAltitude()) {
//             v.put("altitud", loc.getAltitude());
//         } else {
//             v.putNull("altitud");
//         }
//         v.put("velocidad", loc.getSpeed() * 3.6);
//         v.put("accuracy", loc.getAccuracy());
//         String fecha = sdf.format(new Date());
//         v.put("fechaGps", fecha);
//         v.put("fechaRegistro", fecha);
//         v.put("procesado_ui", 0);
//         v.put("syncedDB", 0);

//         db.insertOrThrow("APPD_RegistroLocationRutaPME", null, v);
//         android.util.Log.d("PME_NATIVO", "✅ PUNTO GUARDADO EN DB: Lat " + loc.getLatitude() + " ID: " + idTrazado);
//     } catch (Exception e) {
//         android.util.Log.e("PME_NATIVO", "❌ ERROR DB: " + e.getMessage());
//     } 
// }

// Inicio el hilo para sincronizar la ubicacion  cada 60 segundos
private void startLiveLocationSync() {
      synchronized (liveSyncLock) {
          if (liveSyncHandler == null) return;

          liveSyncEnabled = true;
          if (liveSyncRunnable == null) {
              liveSyncRunnable = new Runnable() {
                  @Override
                  public void run() {
                      try {
                          android.util.Log.d("PME_SYNC", "Ciclo de sincronizacion viva; watchers=" + watchers.size());
                          syncLatestPendingLocationForActiveWatchers();
                      } catch (Exception e) {
                          android.util.Log.e("PME_SYNC", "Error programando sincronizacion viva: " + e.getMessage());
                      } finally {
                          synchronized (liveSyncLock) {
                              if (liveSyncEnabled && liveSyncHandler != null && liveSyncRunnable != null) {
                                  liveSyncHandler.postDelayed(liveSyncRunnable, LIVE_SYNC_INTERVAL_MS);
                              }
                          }
                      }
                  }
              };
          }

          // Si el runnable existia pero habia quedado sin programar, lo recuperamos aqui.
          liveSyncHandler.removeCallbacks(liveSyncRunnable);
          liveSyncHandler.postDelayed(liveSyncRunnable, LIVE_SYNC_INTERVAL_MS);
          android.util.Log.d("PME_SYNC", "Sincronizacion viva iniciada cada 60 segundos.");
      }
}

// Cierra el hilo de sincronizacion viva y detiene la programacion de callbacks
private void stopLiveLocationSync() {
      synchronized (liveSyncLock) {
          liveSyncEnabled = false;
          if (liveSyncHandler != null && liveSyncRunnable != null) {
              liveSyncHandler.removeCallbacks(liveSyncRunnable);
          }
          liveSyncRunnable = null;
      }
      android.util.Log.d("PME_SYNC", "Sincronizacion viva detenida.");
}


//Coordina la sincronizacion de ubicacion viva para los watchers activos. Solo se permite un trazado activo a la vez.
private void syncLatestPendingLocationForActiveWatchers() {
      //Obtiene el unico trazado activo. La app no permite dos rutas en operacion.
      final String idTrazado = getActiveTrazadoId();
      if (!hasTrazadoId(idTrazado)) return;

      //Semaforo de sincronizacion, evita multiples peticiones
      if (!isSyncingLiveLocation.compareAndSet(false, true)) return;

      //lanza un hilo para consultar la base de datos 
      new Thread(new Runnable() {
          @Override
          public void run() {
              try {
                  syncLatestPendingLocation(idTrazado);
              } catch (Exception e) {
                  android.util.Log.e("PME_SYNC", "Error sincronizando ubicacion viva: " + e.getMessage());
              } finally {
                  isSyncingLiveLocation.set(false);
              }
          }
      }).start();
}

private String getActiveTrazadoId() {
      for (Watcher watcher : watchers) {
          if (hasTrazadoId(watcher.idTrazado)) {
              return watcher.idTrazado;
          }
      }
      return getPersistedActiveTrazadoId();
}

//
private void syncLatestPendingLocation(String idTrazado) throws Exception {
      SQLiteDatabase database = openTrackingDatabase();
      if (database == null || !database.isOpen()) {
          android.util.Log.w("PME_SYNC", "Base de datos no disponible para sincronizar puntos.");
          return;
      }

      JSONArray records = new JSONArray();
      Cursor cursor = null;

      try {
          cursor = database.rawQuery(
                  "SELECT idRegistro, idTrazado, fechaGps, latitud, longitud, altitud, velocidad, accuracy, procesado_ui, fechaRegistro, idUser " +
                          "FROM APPD_RegistroLocationRutaPME " +
                          "WHERE idTrazado = ? AND COALESCE(syncedDB, 0) = 0 " +
                          "ORDER BY fechaGps DESC, idRegistro DESC LIMIT ?",
                  new String[]{idTrazado, String.valueOf(LIVE_SYNC_LIMIT)}
          );

          while (cursor.moveToNext()) {
              JSONObject payload = new JSONObject();
              payload.put("localId", getCursorString(cursor, "idRegistro"));
              payload.put("idTrazadoLocal", getCursorString(cursor, "idTrazado"));
              payload.put("fechaGps", getCursorString(cursor, "fechaGps"));
              payload.put("latitud", cursor.getDouble(cursor.getColumnIndexOrThrow("latitud")));
              payload.put("longitud", cursor.getDouble(cursor.getColumnIndexOrThrow("longitud")));
              int altitudeIndex = cursor.getColumnIndexOrThrow("altitud");
              if (cursor.isNull(altitudeIndex)) {
                  payload.put("altitud", JSONObject.NULL);
              } else {
                  payload.put("altitud", cursor.getDouble(altitudeIndex));
              }
              payload.put("velocidad", cursor.getDouble(cursor.getColumnIndexOrThrow("velocidad")));
              payload.put("accuracy", cursor.getDouble(cursor.getColumnIndexOrThrow("accuracy")));
              payload.put("procesadoUi", cursor.getInt(cursor.getColumnIndexOrThrow("procesado_ui")));
              payload.put("fechaRegistro", getFechaRegistro(cursor));
              if (!cursor.isNull(cursor.getColumnIndexOrThrow("idUser"))) {
                  payload.put("idUserRegistro", cursor.getInt(cursor.getColumnIndexOrThrow("idUser")));
              }
              payload.put("deviceId", getNativeDeviceId());
              records.put(payload);
          }
      } finally {
          if (cursor != null) {
              cursor.close();
          }
      }

      if (records.length() == 0) {
          android.util.Log.d("PME_SYNC", "No hay puntos pendientes para idTrazado=" + idTrazado);
          return;
      }

      JSONObject response = postJsonArray(getLocationSyncEndpoint(), records);
      JSONArray results = response.optJSONArray("results");
      if (results == null) {
          android.util.Log.w("PME_SYNC", "El backend no devolvio results.");
          return;
      }

      String syncDate = response.optString("fechaSincronizacion", sdf.format(new Date()));
      java.util.List<String> confirmedIds = new java.util.ArrayList<>();
      for (int i = 0; i < results.length(); i++) {
          JSONObject result = results.optJSONObject(i);
          if (result != null && result.optBoolean("synced", false)) {
              String localId = result.optString("localId", "");
              if (localId.trim().length() > 0) {
                  confirmedIds.add(localId);
              }
          }
      }

      markLocationsAsSynced(confirmedIds, syncDate);
      android.util.Log.d("PME_SYNC", "Puntos vivos enviados=" + records.length() + ", confirmados=" + confirmedIds.size());
  }

  //toma el endpoint y el registro que se debe sincronizar,
  private JSONObject postJsonArray(String endpointUrl, JSONArray records) throws Exception {
      String accessToken = getStoredAccessToken();
      if (accessToken == null || accessToken.trim().length() == 0) {
          accessToken = refreshAccessToken(null);
      }

      HttpResponse response = executeJsonPost(endpointUrl, records.toString(), accessToken, false);
      if (response.statusCode == HttpURLConnection.HTTP_UNAUTHORIZED) {
          android.util.Log.w("PME_SYNC", "JWT vencido; renovando token nativamente.");
          accessToken = refreshAccessToken(accessToken);
          response = executeJsonPost(endpointUrl, records.toString(), accessToken, false);
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
          throw new Exception("HTTP " + response.statusCode + ": " + response.body);
      }

      return new JSONObject(response.body);
  }

  private HttpResponse executeJsonPost(
          String endpointUrl,
          String requestBody,
          String bearerToken,
          boolean mobileClient
  ) throws Exception {
      HttpURLConnection connection = null;
      try {
          URL url = new URL(endpointUrl);
          connection = (HttpURLConnection) url.openConnection();
          connection.setRequestMethod("POST");
          connection.setConnectTimeout(15000);
          connection.setReadTimeout(20000);
          connection.setDoOutput(true);
          connection.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
          connection.setRequestProperty("Accept", "application/json");
          if (mobileClient) {
              connection.setRequestProperty("X-Client-Platform", "mobile");
          }
          if (bearerToken != null && bearerToken.trim().length() > 0) {
              connection.setRequestProperty("Authorization", "Bearer " + bearerToken);
          }

          OutputStream os = connection.getOutputStream();
          try {
              byte[] input = requestBody.getBytes("UTF-8");
              os.write(input, 0, input.length);
          } finally {
              os.close();
          }

          int statusCode = connection.getResponseCode();
          InputStream responseStream = statusCode >= 200 && statusCode < 300
                  ? connection.getInputStream()
                  : connection.getErrorStream();
          String body = readStream(responseStream);
          return new HttpResponse(statusCode, body);
      } finally {
          if (connection != null) {
              connection.disconnect();
          }
      }
  }

  private String refreshAccessToken(String rejectedAccessToken) throws Exception {
      synchronized (tokenRefreshLock) {
          String currentAccessToken = getStoredAccessToken();
          if (rejectedAccessToken != null
                  && currentAccessToken != null
                  && !currentAccessToken.equals(rejectedAccessToken)) {
              return currentAccessToken;
          }

          SharedPreferences preferences = getCapacitorPreferences();
          String refreshToken = preferences.getString("refreshtoken", null);
          if (refreshToken == null || refreshToken.trim().length() == 0) {
              throw new Exception("No hay refresh token disponible para renovar la sesion.");
          }

          JSONObject refreshRequest = new JSONObject();
          refreshRequest.put("refreshToken", refreshToken);
          HttpResponse refreshResponse = executeJsonPost(
                  getAuthRefreshEndpoint(),
                  refreshRequest.toString(),
                  null,
                  true
          );

          if (refreshResponse.statusCode < 200 || refreshResponse.statusCode >= 300) {
              throw new Exception("No fue posible renovar el JWT. HTTP "
                      + refreshResponse.statusCode + ": " + refreshResponse.body);
          }

          JSONObject payload = new JSONObject(refreshResponse.body);
          String newAccessToken = payload.optString("token", "");
          if (newAccessToken.trim().length() == 0) {
              throw new Exception("La respuesta de refresh no contiene token.");
          }

          SharedPreferences.Editor editor = preferences.edit().putString("token", newAccessToken);
          String newRefreshToken = payload.optString("refreshToken", "");
          if (newRefreshToken.trim().length() > 0) {
              editor.putString("refreshtoken", newRefreshToken);
          }
          if (!editor.commit()) {
              throw new Exception("No fue posible persistir el JWT renovado.");
          }

          android.util.Log.d("PME_SYNC", "JWT renovado y persistido correctamente.");
          return newAccessToken;
      }
  }

  private static class HttpResponse {
      final int statusCode;
      final String body;

      HttpResponse(int statusCode, String body) {
          this.statusCode = statusCode;
          this.body = body;
      }
  }

  private void markLocationsAsSynced(java.util.List<String> ids, String syncDate) {
      if (ids == null || ids.isEmpty()) return;

      SQLiteDatabase database = openTrackingDatabase();
      if (database == null || !database.isOpen()) return;

      StringBuilder placeholders = new StringBuilder();
      String[] args = new String[ids.size() + 1];
      args[0] = syncDate;

      for (int i = 0; i < ids.size(); i++) {
          if (i > 0) placeholders.append(",");
          placeholders.append("?");
          args[i + 1] = String.valueOf(ids.get(i));
      }

      database.execSQL(
              "UPDATE APPD_RegistroLocationRutaPME SET syncedDB = 1, syncDBDate = ? WHERE idRegistro IN (" + placeholders + ")",
              args
      );
  }

  private SQLiteDatabase openTrackingDatabase() {
      if (db != null && db.isOpen()) {
          return db;
      }

      File dbFile = getApplicationContext().getDatabasePath("appRecognition_dbSQLite.db");
      if (!dbFile.exists()) {
          return null;
      }

      db = SQLiteDatabase.openDatabase(dbFile.getAbsolutePath(), null, SQLiteDatabase.OPEN_READWRITE);
      return db;
  }

  private String getFechaRegistro(Cursor cursor) {
      String fechaRegistro = getCursorString(cursor, "fechaRegistro");
      if (fechaRegistro == null || fechaRegistro.trim().length() == 0) {
          return getCursorString(cursor, "fechaGps");
      }
      return fechaRegistro;
  }

  private String getCursorString(Cursor cursor, String columnName) {
      int index = cursor.getColumnIndexOrThrow(columnName);
      return cursor.isNull(index) ? null : cursor.getString(index);
  }

  private String readStream(InputStream stream) throws Exception {
      if (stream == null) return "";

      BufferedReader reader = new BufferedReader(new InputStreamReader(stream, "UTF-8"));
      StringBuilder result = new StringBuilder();
      String line;
      try {
          while ((line = reader.readLine()) != null) {
              result.append(line);
          }
      } finally {
          reader.close();
      }
      return result.toString();
  }

  private String getNativeDeviceId() {
      String androidId = Settings.Secure.getString(
              getApplicationContext().getContentResolver(),
              Settings.Secure.ANDROID_ID
      );
      return androidId == null || androidId.trim().length() == 0 ? "unknown-device" : androidId;
  }

  //busca el endpoint en strings.xml, si no lo encuentra utiliza DEFAULT_LOCATION_SYNC_ENDPOINT
  private String getLocationSyncEndpoint() {
      int resourceId = getApplicationContext().getResources().getIdentifier(
              "seddbe_background_geolocation_location_sync_endpoint",
              "string",
              getApplicationContext().getPackageName()
      );
      if (resourceId != 0) {
          String endpoint = getApplicationContext().getString(resourceId);
          if (endpoint != null && endpoint.trim().length() > 0) {
              return endpoint;
          }
      }
      return DEFAULT_LOCATION_SYNC_ENDPOINT;
  }

  private String getAuthRefreshEndpoint() {
      int resourceId = getApplicationContext().getResources().getIdentifier(
              "seddbe_background_geolocation_auth_refresh_endpoint",
              "string",
              getApplicationContext().getPackageName()
      );
      if (resourceId != 0) {
          String endpoint = getApplicationContext().getString(resourceId);
          if (endpoint != null && endpoint.trim().length() > 0) {
              return endpoint;
          }
      }
      return DEFAULT_AUTH_REFRESH_ENDPOINT;
  }

  private SharedPreferences getCapacitorPreferences() {
      return getApplicationContext().getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
  }

  private String getStoredAccessToken() {
      return getCapacitorPreferences().getString("token", null);
  }
}
