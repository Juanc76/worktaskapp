package sed.edu.co.dbeapp.facequality;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.util.Log;
import android.graphics.Rect;

import com.getcapacitor.*;
import com.getcapacitor.annotation.*;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.face.*;
import com.google.mlkit.vision.facemesh.*;

import org.tensorflow.lite.Interpreter;
import org.tensorflow.lite.support.common.FileUtil;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.MappedByteBuffer;
/*
@CapacitorPlugin(name = "FaceQuality")
public class FaceQualityPlugin extends Plugin {

    @PluginMethod
    public void check(PluginCall call) {
        String base64 = call.getString("image");

        if (base64 == null) {
            call.reject("No image provided");
            return;
        }

        try {
            byte[] decoded = Base64.decode(base64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);

            InputImage image = InputImage.fromBitmap(bitmap, 0);

            FaceDetectorOptions options =
                new FaceDetectorOptions.Builder()
                    .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                    .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
                    .build();

            FaceDetector detector = FaceDetection.getClient(options);

            detector.process(image)
                .addOnSuccessListener(faces -> {

                    JSObject result = new JSObject();

                    if (faces.isEmpty()) {
                        result.put("valid", false);
                        result.put("message", "No se detecta rostro");
                        call.resolve(result);
                        return;
                    }

                    Face face = faces.get(0);

                    float leftEye = face.getLeftEyeOpenProbability() != null ? face.getLeftEyeOpenProbability() : 0;
                    float rightEye = face.getRightEyeOpenProbability() != null ? face.getRightEyeOpenProbability() : 0;

                    boolean eyesOpen = leftEye > 0.5 && rightEye > 0.5;

                    result.put("valid", true);
                    result.put("faces", faces.size());
                    result.put("eyesOpen", eyesOpen);

                    call.resolve(result);
                })
                .addOnFailureListener(e -> call.reject(e.getMessage()));

        } catch (Exception e) {
            call.reject("Error processing image");
        }
    }
}*/
// Metodo activo: detección rápida de un rostro con ML Kit.
@CapacitorPlugin(name = "FaceQuality")
public class FaceQualityPlugin extends Plugin {

    private FaceDetector detector;

    @Override
    public void load() {

        // Inicializa el detector una sola vez al cargar el plugin
        FaceDetectorOptions options = new FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
                .setMinFaceSize(0.15f)
                .build();
        detector = FaceDetection.getClient(options);
    }

    @PluginMethod
    public void check(PluginCall call) {
        String base64 = call.getString("image");

        boolean isLivePreview = call.getBoolean("isLivePreview", false);

        if (base64 == null) {
            call.reject("No image provided");
            return;
        }

        try {
            byte[] decoded = Base64.decode(base64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
            InputImage image = InputImage.fromBitmap(bitmap, 0);

            detector.process(image)
                .addOnSuccessListener(faces -> {
                    JSObject result = new JSObject();

                    if (faces.isEmpty()) {
                        result.put("valid", false);
                        result.put("faces", 0);
                        call.resolve(result);
                        return;
                    }

                    // Si solo es para el recuadro verde (isLivePreview),
                    // devolvemos rápido sin cálculos extra.
                    if (isLivePreview) {
                        Rect box = faces.get(0).getBoundingBox();
                        JSObject faceBounds = new JSObject();
                        faceBounds.put("x", Math.max(0f, box.left / (float) bitmap.getWidth()));
                        faceBounds.put("y", Math.max(0f, box.top / (float) bitmap.getHeight()));
                        faceBounds.put("width", Math.min(1f, box.width() / (float) bitmap.getWidth()));
                        faceBounds.put("height", Math.min(1f, box.height() / (float) bitmap.getHeight()));

                        result.put("valid", true);
                        result.put("faces", faces.size());
                        result.put("faceBounds", faceBounds);
                        call.resolve(result);
                        return;
                    }

                    // Validación detallada para la captura final
                    Face face = faces.get(0);
                    float leftEye = face.getLeftEyeOpenProbability() != null ? face.getLeftEyeOpenProbability() : 0;
                    float rightEye = face.getRightEyeOpenProbability() != null ? face.getRightEyeOpenProbability() : 0;

                    // Azure Face API prefiere rostros frontales
                    float headEulerY = face.getHeadEulerAngleY(); // Giro izquierda/derecha
                    boolean isFrontal = Math.abs(headEulerY) < 18;

                    result.put("valid", isFrontal);
                    result.put("faces", faces.size());
                    result.put("eyesOpen", leftEye > 0.4 && rightEye > 0.4);
                    result.put("message", isFrontal ? "" : "Gire la cabeza hacia la cámara");

                    call.resolve(result);
                })
                .addOnFailureListener(e -> call.reject(e.getMessage()));

        } catch (Exception e) {
            call.reject("Error processing image");
        }
    }
}

//Metodo optimizado para validación y almacenamiento automático en captura final, y validación rápida en vista previa
/*
@CapacitorPlugin(name = "FaceQuality")
public class FaceQualityPlugin extends Plugin {

    private FaceDetector detector;

    @Override
    public void load() {
        // Inicializamos el detector una sola vez al cargar el plugin
        FaceDetectorOptions options = new FaceDetectorOptions.Builder()
                .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE)
                .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
                .setMinFaceSize(0.15f)
                .build();
        detector = FaceDetection.getClient(options);
    }

    @PluginMethod
    public void check(PluginCall call) {
        String base64 = call.getString("image");

        boolean isLivePreview = call.getBoolean("isLivePreview", false);

        if (base64 == null) {
            call.reject("No image provided");
            return;
        }

        try {
            byte[] decoded = Base64.decode(base64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
            InputImage image = InputImage.fromBitmap(bitmap, 0);

            detector.process(image)
                .addOnSuccessListener(faces -> {
                    JSObject result = new JSObject();

                    if (faces.isEmpty()) {
                        result.put("valid", false);
                        result.put("faces", 0);
                        call.resolve(result);
                        return;
                    }

                    // Validación detallada para la captura final
                    Face face = faces.get(0);
                    float leftEye = face.getLeftEyeOpenProbability() != null ? face.getLeftEyeOpenProbability() : 0;
                    float rightEye = face.getRightEyeOpenProbability() != null ? face.getRightEyeOpenProbability() : 0;

                    // Azure Face API prefiere rostros frontales
                    float headEulerY = face.getHeadEulerAngleY(); // Giro izquierda/derecha
                    boolean isFrontal = Math.abs(headEulerY) < 15;

                    result.put("valid", isFrontal);
                    result.put("faces", faces.size());
                    result.put("eyesOpen", leftEye > 0.4 && rightEye > 0.4);
                    result.put("message", isFrontal ? "" : "Gire la cabeza hacia la cámara");

                    call.resolve(result);
                })
                .addOnFailureListener(e -> call.reject(e.getMessage()));

        } catch (Exception e) {
            call.reject("Error processing image");
        }
    }
}
*/

/*
 * Implementación anterior con Face Mesh + AuraFace.
 * Se conserva comentada como referencia.
 *
@CapacitorPlugin(name = "FaceQuality")
public class FaceQualityPlugin extends Plugin {

    private FaceMeshDetector meshDetector;
    private Interpreter tflite;
   private static final int TF_INPUT_SIZE = 112; // AuraFace standard
   private static final int EMBEDDING_SIZE = 512; // AuraFace standard

    @Override
    public void load() {
        // Inicializamos el detector de malla 3D
        // Usamos el modo BOUNDING_BOX_ONLY para el preview y FACE_MESH para validación
        FaceMeshDetectorOptions options = new FaceMeshDetectorOptions.Builder()
                .setUseCase(FaceMeshDetectorOptions.FACE_MESH)
                .build();
        meshDetector = FaceMeshDetection.getClient(options);

        try {
            MappedByteBuffer tfliteModel = FileUtil.loadMappedFile(getContext(), "auraface_mobile16.tflite");
            Interpreter.Options tfliteOptions = new Interpreter.Options();
            tflite = new Interpreter(tfliteModel, tfliteOptions);
            android.util.Log.d("FaceQuality", "Modelo auraface_mobile 16 cargado exitosamente");
        } catch (Exception e) {
            android.util.Log.e("FaceQuality", "Error cargando auraface_mobile.tflite: " + e.getMessage());
        }
    }

            private ByteBuffer convertBitmapToByteBuffer(Bitmap bitmap) {
            // 4 bytes * 112 * 112 * 3
            ByteBuffer imgData = ByteBuffer.allocateDirect(4 * TF_INPUT_SIZE * TF_INPUT_SIZE * 3);
            imgData.order(ByteOrder.nativeOrder());

            int[] intValues = new int[TF_INPUT_SIZE * TF_INPUT_SIZE];
            bitmap.getPixels(intValues, 0, bitmap.getWidth(), 0, 0, bitmap.getWidth(), bitmap.getHeight());

            imgData.rewind();
            for (int i = 0; i < TF_INPUT_SIZE; ++i) {
                for (int j = 0; j < TF_INPUT_SIZE; ++j) {
                    int pixelValue = intValues[i * TF_INPUT_SIZE + j];
                    
                    // Normalización estándar para AuraFace (0 a 1)
                    // Si tu modelo pide -1 a 1, usa: (val - 127.5f) / 127.5f
                    imgData.putFloat(((pixelValue >> 16) & 0xFF) / 255.0f);
                    imgData.putFloat(((pixelValue >> 8) & 0xFF) / 255.0f);
                    imgData.putFloat((pixelValue & 0xFF) / 255.0f);
                }
            }
            return imgData;
        }

    @PluginMethod
    public void check(PluginCall call) {
        String base64 = call.getString("image");
        boolean isLivePreview = call.getBoolean("isLivePreview", false);
        if (base64 == null) {
            call.reject("No image provided");
            return;
        }

        try {
            byte[] decoded = Base64.decode(base64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
            InputImage image = InputImage.fromBitmap(bitmap, 0);

            meshDetector.process(image)
                .addOnSuccessListener(meshes -> {
                    JSObject result = new JSObject();

                    if (meshes.isEmpty()) {
                        result.put("valid", false);
                        result.put("faces", 0);
                        call.resolve(result);
                        return;
                    }

                    // Tomamos el primer rostro detectado
                    FaceMesh mesh = meshes.get(0);

                    // Para la vista previa basta confirmar el rostro. Omitir el
                    // embedding TFLite reduce considerablemente la latencia.
                    if (isLivePreview) {
                        result.put("valid", true);
                        result.put("faces", meshes.size());
                        call.resolve(result);
                        return;
                    }

                    if (tflite != null) {
                        try {
                            Rect box = mesh.getBoundingBox();

                            // Validar que el recorte no se salga de los bordes de la foto original
                            int x = Math.max(0, box.left);
                            int y = Math.max(0, box.top);
                            int width = Math.min(box.width(), bitmap.getWidth() - x);
                            int height = Math.min(box.height(), bitmap.getHeight() - y);

                            // Recortar solo la cara
                            Bitmap faceCrop = Bitmap.createBitmap(bitmap, x, y, width, height);
                            // Redimensionar a 160x160
                            Bitmap scaledFace = Bitmap.createScaledBitmap(faceCrop, TF_INPUT_SIZE, TF_INPUT_SIZE, true);

                            // Convertir y ejecutar
                            ByteBuffer inputBuffer = convertBitmapToByteBuffer(scaledFace);
                            float[][] output = new float[1][EMBEDDING_SIZE]; // Array para guardar los 128 números

                            tflite.run(inputBuffer, output);
                             float[] embedding = output[0];
                            normalizeL2(embedding);   
                            
                            // Pasar el vector a Javascript
                            JSArray vectorJS = new JSArray();
                            for (float v : output[0]) {
                                vectorJS.put(v);
                            }
                            result.put("embedding", vectorJS); 

                        } catch (Exception e) {
                            android.util.Log.e("FaceQuality", "Error generando embedding TFLite", e);
                        }
                    }

                    // 1. Obtener puntos clave para la "Huella Digital" (Evitar duplicados)
                    // Enviamos solo unos puntos representativos para no saturar el puente
                    // Punto 0: Nariz, Punto 10: Frente, Punto 152: Mentón
                    JSArray keyPoints = new JSArray();
                    int[] samplePoints = {0, 10, 152, 234, 454}; // Centro y extremos
                    for (int idx : samplePoints) {
                        FaceMeshPoint p = mesh.getAllPoints().get(idx);
                        JSObject point = new JSObject();
                        point.put("x", p.getPosition().getX());
                        point.put("y", p.getPosition().getY());
                        keyPoints.put(point);
                    }

                    // 2. Calcular Ángulo (Frontalidad) para Azure
                    // Con FaceMesh calculamos la rotación de forma manual o estimada
                    // Para simplificar, ML Kit Face Mesh garantiza que si detecta malla completa, el rostro es apto.
                    // Pero podemos validar el Bounding Box
                    float width = mesh.getBoundingBox().width();
                    float height = mesh.getBoundingBox().height();

                    // 3. Resultado
                    result.put("valid", true);
                    result.put("faces", meshes.size());
                    result.put("meshPoints", keyPoints);

                    // Nota: Face Mesh Beta no da probabilidad de ojos directamente como Face Detection.
                    // Si necesitas ojos, se analizan los puntos de los párpados.
                    result.put("eyesOpen", true);

                    call.resolve(result);
                })
                .addOnFailureListener(e -> call.reject(e.getMessage()));

        } catch (Exception e) {
            call.reject("Error processing image");
        }
    }

    private void normalizeL2(float[] embedding) {
    float sum = 0;
    for (float v : embedding) sum += v * v;
    float norm = (float) Math.sqrt(sum);
    for (int i = 0; i < embedding.length; i++) {
        embedding[i] = embedding[i] / norm;
    }
}
}
*/
