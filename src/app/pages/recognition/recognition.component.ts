import { NgIf } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';

import { FaceDetectionResponse, FaceDetectionResultBackend, FacesCandidatesDto } from '../../core/models/recognition.model';
import { MatriculaRepository } from '../../core/repositories/matricula.repository';
import { VectoresRepository, VectorRegistro } from '../../core/repositories/vectores.repository';
import { FaceDetectionService } from '../../core/services/recognition.services';


import { CameraPreview, CameraPreviewOptions } from '@capacitor-community/camera-preview';
import { registerPlugin } from '@capacitor/core';

import { MenuItem, MessageService } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';

const FaceQuality = registerPlugin<any>('FaceQuality');
const MAX_RECOGNITION_DISTANCE = 0.60;

@Component({
  selector: 'app-recognition',
  standalone: true,
  imports: [NgIf, ToastModule, ButtonModule, BreadcrumbModule, RouterModule],
  templateUrl: '../recognition/recognition.component.html',
  styleUrls: ['../recognition/recognition.component.css'],
  providers: [MessageService]
})
export class RecognitionComponent implements OnInit, OnDestroy {
  capturedImage: File | null = null;
  capturedImagePreview: string | null = null;
  detectionResult: FaceDetectionResponse | null = null;
  facesCandidatesDto: FacesCandidatesDto | null = null;
  imageCaptured = false;
  cameraActive = false;
  faceDetectedInRealTime = false;
  msgRecognition = '';
  items: MenuItem[] | undefined;
  home: MenuItem | undefined;

  private faceDetectionInterval: any;
  private isCapturingAutomatically = false;
  private lastCaptureTime = 0;
  private embeddingActual: number[] | null = null;
  private capturedEmbedding: number[] | null = null;

  constructor(
    private facedetectionService: FaceDetectionService,
    private messageService: MessageService,
    private matriculaRepository: MatriculaRepository,
    private vectoresRepository: VectoresRepository,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    this.items = [{ label: 'PAE' }, { label: 'Reconocimiento Facial' }];
    this.home = { icon: 'pi pi-home', routerLink: '/main' };
    await this.openCamera();
  }

  ngOnDestroy() {
    if (this.cameraActive) {
      void this.closeCamera();
    }
  }

  private showCameraToast(
    severity: 'success' | 'info' | 'warn' | 'error',
    summary: string,
    detail: string,
    life = 4500
  ) {
    this.messageService.clear('camera');
    this.messageService.add({ key: 'camera', severity, summary, detail, life });
  }

  async openCamera() {
    if (this.cameraActive) return;

    this.cameraActive = true;
    this.setCameraOverlay(true);
    this.messageService.clear('camera');

    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    try {
      const cameraPreviewOptions: CameraPreviewOptions = {
        position: 'rear',
        toBack: true,
        enableZoom: false
      };

      await CameraPreview.start(cameraPreviewOptions);
      this.startFaceDetectionLoop();
    } catch (err) {
      this.showCameraToast('error', 'Error de camara', 'No se pudo iniciar la camara.');
      this.cameraActive = false;
      this.setCameraOverlay(false);
    }
  }

  private startFaceDetectionLoop() {
    this.faceDetectionInterval = setInterval(async () => {
      if (!this.cameraActive || this.isCapturingAutomatically || this.imageCaptured) return;

      const now = Date.now();
      if (now - this.lastCaptureTime < 1500) return;

      try {
        const result = await CameraPreview.captureSample({ quality: 85 });
        const analysis = await FaceQuality.check({
          image: result.value
        });

        if (analysis.valid) {
          this.faceDetectedInRealTime = true;
          this.embeddingActual = analysis.embedding ? this.normalizarVector(analysis.embedding) : null;
          this.lastCaptureTime = Date.now();
          this.cdr.detectChanges();
        } else {
          this.faceDetectedInRealTime = false;
          this.embeddingActual = null;
          this.cdr.detectChanges();
        }
      } catch (error) {
        console.error('Error en la deteccion de rostro:');
        this.faceDetectedInRealTime = false;
        this.isCapturingAutomatically = false;
        this.embeddingActual = null;
      }
    }, 500);
  }

  private stopFaceDetectionLoop() {
    if (this.faceDetectionInterval) {
      clearInterval(this.faceDetectionInterval);
      this.faceDetectionInterval = null;
    }
    this.faceDetectedInRealTime = false;
  }

  async closeCamera() {
    if (!this.cameraActive) return;

    this.stopFaceDetectionLoop();
    this.cameraActive = false;

    try {
      await CameraPreview.stop();
    } finally {
      this.messageService.clear('camera');
      this.isCapturingAutomatically = false;
      this.setCameraOverlay(false);
    }
  }

  private setCameraOverlay(active: boolean) {
    document.body.classList.toggle('camera-open', active);
  }

  async captureImage() {
    if (!this.faceDetectedInRealTime) {
      this.showCameraToast('warn', 'Atencion', 'No se detecta un rostro claro para capturar.');
      return;
    }

    try {
      this.isCapturingAutomatically = true;
      this.capturedEmbedding = this.embeddingActual ? [...this.embeddingActual] : null;
      const result = await CameraPreview.capture({ quality: 85 });
      this.capturedImagePreview = `data:image/jpeg;base64,${result.value}`;
      this.capturedImage = this.base64ToFile(result.value, `recognition_${Date.now()}.jpg`);
      this.imageCaptured = true;
      this.faceDetectedInRealTime = false;
      this.cdr.detectChanges();
    } catch (error) {
      this.showCameraToast('error', 'Error', 'No se pudo procesar la imagen.');
    } finally {
      this.isCapturingAutomatically = false;
    }
  }

  async retakePhoto() {
    this.imageCaptured = false;
    this.capturedImage = null;
    this.capturedImagePreview = null;
    this.msgRecognition = '';
    this.embeddingActual = null;
    this.capturedEmbedding = null;
    this.faceDetectedInRealTime = false;

    if (!this.cameraActive) {
      await this.openCamera();
    }
  }

  uploadImage() {
    if (this.capturedImage) {
      this.facedetectionService.detectFaces(this.capturedImage).subscribe({
        next: (response: FaceDetectionResponse) => {
          this.detectionResult = response;
          this.messageService.add({ severity: 'success', summary: 'Exito', detail: response.message });
          this.drawFaces(response.results);
        },
        error: (err) => {
          const detail = err.mensaje || 'No se pudo identificar la causa del error, por favor comuniquese con soporte.';
          this.messageService.add({ severity: 'error', summary: 'Error de Deteccion', detail });
          console.error('Error en deteccion:');
          this.detectionResult = null;
        }
      });
    } else {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Capture una imagen primero.'
      });
    }
  }

  async recognitionFace() {
    if (this.capturedImage) {
      this.facedetectionService.recognitionFaces(this.capturedImage).subscribe({
        next: (response: FacesCandidatesDto) => {
          this.facesCandidatesDto = response;
          const detail = `Persona: ${this.facesCandidatesDto.nombre1 || ''} ${this.facesCandidatesDto.nombre2 || ''} ${this.facesCandidatesDto.apellido1 || ''} ${this.facesCandidatesDto.apellido2 || ''}
                          Confianza: ${this.facesCandidatesDto.confidence}`;
          this.msgRecognition = detail;
          this.messageService.add({ severity: 'info', summary: 'Reconocimiento Exitoso', detail, sticky: true });
        },
        error: (err) => {
       
          const detail = err.mensaje ? `La identificacion no fue exitosa. ${err.mensaje}` : 'La identificacion no fue exitosa.';
          this.messageService.add({ severity: 'error', summary: 'Error de Identificacion', detail });
          this.detectionResult = null;
        }
      });
    } else {
      this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Por favor, captura una imagen primero.' });
    }
  }

  async recognitionLocalFace() {
    if (!this.capturedImage) {
      this.messageService.add({ severity: 'warn', summary: 'Advertencia', detail: 'Por favor, captura una imagen primero.' });
      return;
    }

    try {
      const nuevoEmbedding = this.capturedEmbedding ?? await this.obtenerEmbeddingDesdeImagen(this.capturedImage);
      if (!nuevoEmbedding) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Reconocimiento',
          detail: 'No se encontro un vector facial valido para comparar.'
        });
        return;
      }

      await this.vectoresRepository.rebuildVectorPromedios();
      const vectores = await this.vectoresRepository.getVectorPromedios();
      if (vectores.length === 0) {
        this.msgRecognition = 'No hay vectores promedio disponibles para reconocimiento local.';
        this.messageService.add({
          severity: 'warn',
          summary: 'Sin vectores',
          detail: this.msgRecognition
        });
        return;
      }

      const mejorCoincidencia = this.buscarMejorCoincidencia(nuevoEmbedding, vectores);

      if (!mejorCoincidencia || mejorCoincidencia.distancia >= MAX_RECOGNITION_DISTANCE) {
        this.msgRecognition = 'No se encontro una coincidencia en la base local.';
        this.messageService.add({
          severity: 'warn',
          summary: 'Sin coincidencia',
          detail: this.msgRecognition
        });
        return;
      }

      const matricula = await this.matriculaRepository.getMatriculaByPerId(mejorCoincidencia.perID);
      if (!matricula) {
        this.msgRecognition = `Per_ID: ${mejorCoincidencia.perID}
Similitud local: ${(mejorCoincidencia.similitud * 100).toFixed(1)}%
Distancia: ${mejorCoincidencia.distancia.toFixed(3)}`;
        this.messageService.add({
          severity: 'info',
          summary: 'Reconocimiento local',
          detail: this.msgRecognition,
          sticky: true
        });
        return;
      }

      const detail = `Persona: ${matricula.nombre1 || ''} ${matricula.nombre2 || ''} ${matricula.apellido1 || ''} ${matricula.apellido2 || ''}
Documento: ${matricula.numeroDocumento || ''}
Per_ID: ${matricula.perID}
Similitud local: ${(mejorCoincidencia.similitud * 100).toFixed(1)}%
Distancia: ${mejorCoincidencia.distancia.toFixed(3)}`;

      this.msgRecognition = detail;
      this.messageService.add({ severity: 'info', summary: 'Reconocimiento Local Exitoso', detail, sticky: true });
    } catch (err) {
  
      this.messageService.add({
        severity: 'error',
        summary: 'Error de Identificacion',
        detail: 'No se pudo realizar el reconocimiento con la base local.'
      });
    }
  }

  private async obtenerEmbeddingDesdeImagen(file: File): Promise<number[] | null> {
    const base64Image = await this.fileToBase64(file);
    const analysis = await FaceQuality.check({ image: base64Image });

    if (!analysis.valid || !analysis.embedding) return null;

    return this.normalizarVector(analysis.embedding);
  }

  private async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = String(reader.result ?? '');
        resolve(value.includes(',') ? value.split(',')[1] : value);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  private base64ToFile(data: string | Blob, filename: string, contentType = 'image/jpeg'): File {
    if (typeof data !== 'string') {
      return new File([data], filename, { type: contentType });
    }

    const base64Data = data.includes(',') ? data.split(',')[1] : data;
    const byteChars = atob(base64Data);
    const byteNumbers = new Array(byteChars.length);

    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: contentType });
    return new File([blob], filename, { type: contentType });
  }

  private buscarMejorCoincidencia(nuevoEmbedding: number[], vectores: VectorRegistro[]): { perID: string; distancia: number; similitud: number } | null {
    let mejorCoincidencia: { perID: string; distancia: number; similitud: number } | null = null;

    for (const registro of vectores) {
      const vectorGuardado = this.parseEmbedding(registro.faceEmbedding);
      if (!vectorGuardado) continue;

      const distancia = this.calcularDistanciaEuclidiana(vectorGuardado, nuevoEmbedding);
      const similitud = this.calcularSimilitudCoseno(vectorGuardado, nuevoEmbedding);
      if (!mejorCoincidencia || distancia < mejorCoincidencia.distancia) {
        mejorCoincidencia = { perID: registro.perID, distancia, similitud };
      }
    }

    return mejorCoincidencia;
  }

  private parseEmbedding(faceEmbedding: string): number[] | null {
    try {
      const vector = JSON.parse(faceEmbedding);
      return Array.isArray(vector) ? vector.map(Number) : null;
    } catch {
      return null;
    }
  }

  private calcularDistanciaEuclidiana(v1: number[], v2: number[]): number {
    if (!v1 || !v2 || v1.length !== v2.length) return Infinity;

    let suma = 0;
    for (let i = 0; i < v1.length; i++) {
      suma += Math.pow(v1[i] - v2[i], 2);
    }
    return Math.sqrt(suma);
  }

  private calcularSimilitudCoseno(v1: number[], v2: number[]): number {
    if (!v1 || !v2 || v1.length !== v2.length) return 0;

    let productoPunto = 0;
    for (let i = 0; i < v1.length; i++) {
      productoPunto += v1[i] * v2[i];
    }

    return Math.min(1, Math.max(0, productoPunto));
  }

  private normalizarVector(vector: number[]): number[] {
    let sumaCuadrados = 0;
    for (let i = 0; i < vector.length; i++) {
      sumaCuadrados += vector[i] * vector[i];
    }

    const magnitud = Math.sqrt(sumaCuadrados);
    if (magnitud === 0) return vector;

    const vectorNormalizado = new Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      vectorNormalizado[i] = vector[i] / magnitud;
    }

    return vectorNormalizado;
  }

  drawFaces(faces: FaceDetectionResultBackend[]): void {
    this.messageService.add({
      severity: 'info',
      summary: 'Deteccion',
      detail: `Rostros detectados: ${faces.length}`
    });
  }
}
