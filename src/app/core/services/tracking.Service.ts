import { registerPlugin } from '@capacitor/core';
import { Injectable } from '@angular/core';

import {
  TrackingState,
  RegistroTrazadoRutaPMEBD
} from '../models/tracking.model';

import { DatabaseService } from './database.service';
import { RegistroTrazadoRutaPMERepository } from '../repositories/registroTrazadoRutaPME.repository';
import { ActiveTrackingRepository } from '../repositories/activeTracking.repository';
import { AuthService } from '../auth/auth.service';

import { BehaviorSubject, map } from 'rxjs';
import type { BackgroundGeolocationPlugin } from 'seddbe-background-geolocation';
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

@Injectable({ providedIn: 'root' })

export class TrackingService {
  
  private trackingActivo$ = new BehaviorSubject<TrackingState>({
    active: false,
    paused: false,
    trazado: null,
    duration: 0,
    distance: 0,
    speedMedia:0,
  });
  public lastLocation$ = new BehaviorSubject<any>(null);

  private watchId: string | null = null;
  private DistanciaMetros: number = 0;
  private HoradeInicio: number | null = null;
  private timerInterval: any;
  private totalltiempo = 0;
  private velocidadMedia: number = 0;
  private filtroDistanciaMetros = 0;

  constructor(private dbService: DatabaseService, 
    private registroTrazadoRutaPMERepository: RegistroTrazadoRutaPMERepository,
     private activeTrackingRepository: ActiveTrackingRepository,
     private authService: AuthService) {}

  private async ensureDbReady(): Promise<void> {
    try {
      await this.dbService.init();
    } catch (e) {
      console.error('No se pudo inicializar SQLite para TrackingService:', e);
    }
  }

  isTracking$() {
    return this.trackingActivo$.asObservable();
  }

  isTrackingActive$() {
  return this.trackingActivo$.pipe(map(state=> state.active)
  );
}
  
  async startTracking(registro: RegistroTrazadoRutaPMEBD) {
    if (this.watchId) return;

    await this.ensureDbReady();
    
 
        if (!registro.idTrazado) {
          console.error('No se puede iniciar el tracking de la Ruta sin un idTrazado válido.');
          return;
        } 
        this.DistanciaMetros = 0;
        this.totalltiempo = 0;
        this.HoradeInicio = Date.now();
        this.velocidadMedia = 0;
        const idUser = await this.getTrackingUserId();

      this.trackingActivo$.next({ active: true, paused: false, trazado: registro, duration: 0, distance: 0, speedMedia: 0 });
      this.calculateTotalTime();
      await this.activeTrackingRepository.saveActiveTracking({idTrazado: registro.idTrazado!, activo: true, distanciaAcumulada: 0, tiempoAcumulado: 0});
      this.watchId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: "Realizando seguimiento de la ruta escolar...",
        backgroundTitle: "Seguimiento activo a la ruta " + registro.rutaEscolar,
        requestPermissions: true,
        stale: false,
        distanceFilter: this.filtroDistanciaMetros,
        idTrazado: registro.idTrazado!,
        idUser,
        initialDistance: 0
       
      },
      async (location: any, error: any) => {
        if (error) {
          console.error("Error en background tracking", error);
          return;
        }
        if (location) {
          this.procesarBuffer(location); 
        }
      }
    ); 
     
   }

private procesarBuffer(locationNative?: any) {
    if (!locationNative) return;
     console.log('Procesando nuevo en angular punto GPS:', `latitude: ${locationNative.latitude},  longitude: ${locationNative.longitude},    accuracy: ${locationNative.accuracy},
    `);

    // 2. Actualización inmediata del Odómetro
    if (locationNative.totalDistance !== undefined) {
        this.DistanciaMetros = locationNative.totalDistance;
    }

    // 3. Publicamos el punto para el mapa
    this.lastLocation$.next({
        latitude: locationNative.latitude,
        longitude: locationNative.longitude,
        altitude: locationNative.altitude ?? null,
        speed: locationNative.speed ?? 0,
        time: locationNative.time || new Date().toISOString()
    });

    this.calculateAverageSpeed();
    this.updateUI(); 
}

private async updateUI() {
  const currentStatus = this.trackingActivo$.value;
  if (currentStatus) {
    this.trackingActivo$.next({
      ...currentStatus,
      duration: this.totalltiempo,
      distance: this.DistanciaMetros,
      speedMedia: this.velocidadMedia
    });
  }
}
 get snapshot() {
    return this.trackingActivo$;
  }
  
  async stopTracking() {

    await this.ensureDbReady();
    
    await this.procesarBuffer();

    if (this.watchId) {
      await BackgroundGeolocation.removeWatcher({ id: this.watchId });
      this.watchId = null;
    }

        const trazadoId = this.trackingActivo$.value.trazado?.idTrazado;
      if (trazadoId) {
          await this.registroTrazadoRutaPMERepository.updateRegistroTrazadoRutaPME(
          trazadoId,
          this.trackingActivo$.value.distance,
          this.trackingActivo$.value.duration,
          this.trackingActivo$.value.speedMedia
        );
        await this.activeTrackingRepository.deleteActiveTrackingByIdTrazado(trazadoId);
      } else {
        console.warn('stopTracking(): no hay idTrazado para cerrar en DB; limpiando estado en memoria.');
      }
      this.trackingActivo$.next({
      active: false,
      paused: false,
      trazado: null,
      duration: 0,
      distance: 0,
      speedMedia:0
      });

      this.DistanciaMetros = 0;
      this.HoradeInicio = null;
      this.totalltiempo = 0;
      this.timerInterval && clearInterval(this.timerInterval);
        console.log('Tracking de la ruta  detenido.');
    
  }

  async pauseTracking() {
    if (this.watchId) {
    await BackgroundGeolocation.removeWatcher({ id: this.watchId });
    this.watchId = null;
    }

    if (this.timerInterval) {
     clearInterval(this.timerInterval);
    this.timerInterval = null;
    }
    
    this.trackingActivo$.next({
    ...this.trackingActivo$.value,
    paused: true
    });
    
    console.log('Tracking pausado.');
    
  }

  async reactivateTracking() {
    if (this.trackingActivo$.value.paused) {
      this.HoradeInicio = Date.now() - (this.totalltiempo * 1000);
      const idUser = await this.getTrackingUserId();
      console.log('Reanudando tracking... HoradeInicio ajustada a:', new Date(this.HoradeInicio).toISOString());
      console.log("Seguimiento activo a la ruta " + this.trackingActivo$.value.trazado?.rutaEscolar);
       this.watchId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: "Realizando seguimiento de la ruta escolar...",
        backgroundTitle: "Seguimiento activo a la ruta " + this.trackingActivo$.value.trazado?.rutaEscolar,
        requestPermissions: true,
        stale: false,
        distanceFilter: this.filtroDistanciaMetros,
        idTrazado: this.trackingActivo$.value.trazado?.idTrazado!,
        idUser,
        initialDistance:  this.trackingActivo$.value.distance
       
      },
      async (location: any, error: any) => {
        if (error) {
          console.error("Error en background tracking", error);
          return;
        }
        if (location) {

         this.procesarBuffer(location); 
        }
      }
    );
      this.calculateTotalTime();
      this.trackingActivo$.next({
        ...this.trackingActivo$.value,
        paused: false
      });
      console.log('Tracking reanudado.');
    }
  }

 async reactivateTrackingifNeeded() {

  await this.ensureDbReady();

    if (this.trackingActivo$.value.active || this.watchId) {
      console.log('El seguimiento ya está corriendo en memoria, ignorando reactivateTrackingifNeeded.');
      return;
    }
      // 1. Consultar a la DB el último estado guardado
    const ultimoestadoState = await this.activeTrackingRepository.getActiveTracking();

    if (!ultimoestadoState || !ultimoestadoState.activo) {
    console.log('No hay rutas previas para reanudar.');
    return;
    }

  console.log('Restaurando sesión de ruta...', ultimoestadoState);

  // 2. Restaurar las variables privadas del servicio
  // Estos valores deben venir de lo que guardaste en la DB antes de que se cerrara la app
  this.DistanciaMetros = ultimoestadoState.distanciaAcumulada || 0;
  this.totalltiempo = ultimoestadoState.tiempoAcumulado || 0;
  this.HoradeInicio = Date.now() - (this.totalltiempo * 1000);
  const idUser = await this.getTrackingUserId();

  const trazado : RegistroTrazadoRutaPMEBD | null = await this.registroTrazadoRutaPMERepository.getRegistroTrazadoRutaPMEById(ultimoestadoState.idTrazado);
  if (!trazado) {
    console.warn('No se encontró el trazado asociado para reanudar; limpiando active_tracking.');
    await this.activeTrackingRepository.deleteActiveTrackingByIdTrazado(ultimoestadoState.idTrazado);
    return;
  }
    
  // 3. Reconstruir el BehaviorSubject
    this.trackingActivo$.next({
    active: true,
    paused: false,
    trazado: trazado, 
    duration: this.totalltiempo,
    distance: this.DistanciaMetros,
    speedMedia: this.velocidadMedia
     });

    
  // Reiniciar el Watcher de GPS
     this.watchId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: "Realizando seguimiento de la ruta escolar...",
        backgroundTitle: "Seguimiento activo a la ruta " + trazado.rutaEscolar,
        requestPermissions: true,
        stale: false,
        distanceFilter: this.filtroDistanciaMetros,
        idTrazado: trazado.idTrazado!,
        idUser,
        initialDistance: trazado.distanciaAcumulada
       
      },
      async (location: any, error: any) => {
        if (error) {
          console.error("Error en background tracking", error);
          return;
        }
        if (location) {

          this.procesarBuffer(location);
        }
      }
    );
   
    this.calculateTotalTime(); // Inicia el setInterval de nuevo
   
}


private async getTrackingUserId(): Promise<number> {
  const idUser = await this.authService.getCurrentUserId();

  if (idUser === null) {
    console.warn('No se encontro idUser en el JWT para tracking; se usara 0.');
    return 0;
  }

  return idUser;
}

private async calculateTotalTime() : Promise<void>{
  this.timerInterval && clearInterval(this.timerInterval);
     this.timerInterval = setInterval(() => {
    if (this.HoradeInicio) {
        this.totalltiempo = Math.floor((Date.now() - this.HoradeInicio) / 1000);
        this.updateUI();


        if (this.totalltiempo > 0 && this.totalltiempo % 30 === 0) { 
             this.activeTrackingRepository.updateActiveTracking(
                this.trackingActivo$.value.trazado?.idTrazado!, 
                this.DistanciaMetros, 
                this.totalltiempo
             ).catch(err => console.error("Error actualizando tracking periódico:", err));
        }
    }
  }, 1000);
}

    private calculateAverageSpeed(): number {
       
        if (this.DistanciaMetros > 0 && this.totalltiempo > 0) {
          this.velocidadMedia = parseFloat(((this.DistanciaMetros / this.totalltiempo) * 3.6).toFixed(1));
        } else {
          this.velocidadMedia = 0;
        }
        return this.velocidadMedia;
}
      
}
