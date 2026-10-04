import { Component,ViewChild, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { DatePipe, CommonModule } from '@angular/common';
import { ActivatedRoute,RouterLink } from '@angular/router';
import { CameraPreview, CameraPreviewOptions } from '@capacitor-community/camera-preview';
import { registerPlugin } from '@capacitor/core';

import { DEFAULT_SELECTED_GRADOS, PhotoRecordPAE, PhotoRecordPAESummary, SelectedGrado } from '../../../core/models/photoRecordPAE.model';
import { PhotoStorageServicePAE} from '../../../core/services/photoRecordPAE.service';
import { RecordsDelivery} from '../../../core/models/registroEntregaPAE.model';
import { RegistroEntregaPaeSyncService } from '../../../core/services/registroEntregaPaeSync.service';
import { PhotosPAERepository } from '../../../core/repositories/photosPAE.repository'; 
import { RegistroEntregaPAERepository} from '../../../core/repositories/RegistroEntregaPAE.repository'; 
import { GradosSitioEntregaRepository } from '../../../core/repositories/gradosSitioEntrega.repository';

import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { MenuItem } from 'primeng/api';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

import { IonButton,  IonButtons, IonContent, IonHeader,  IonModal,    IonTitle,  IonToolbar,
         IonInfiniteScroll, IonInfiniteScrollContent,  InfiniteScrollCustomEvent,  IonCard,  IonCardContent,IonChip,
         IonCheckbox } from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';

const FaceQuality = registerPlugin<any>('FaceQuality');

@Component({
  selector: 'app-photo-record',
  standalone: true,
  imports: [ IonButton,  IonButtons, IonContent, IonHeader,  IonModal,    IonTitle,  IonToolbar,
         IonInfiniteScroll, IonInfiniteScrollContent,  IonCard,  IonCardContent,IonChip,
          IonCheckbox,  FormsModule,
          ToastModule, ButtonModule,  ToastModule, ConfirmDialogModule,  DatePipe, 
          CommonModule, ProgressBarModule,   BreadcrumbModule, ButtonModule,   RouterLink],
  providers: [ConfirmationService, MessageService],
  templateUrl: '../photoRecord/photoRecordPAE.component.html',
  styleUrls: ['../photoRecord/photoRecordPAE.component.css'],
 
})

export class PhotoRecordComponent implements OnInit, OnDestroy {
  // Breadcrumb
  items: MenuItem[] | undefined;
  home: MenuItem | undefined;
  
  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;
  
  // Variables para manejo de fotos
  cameraActive :  boolean = false;
  faceDetectedInRealTime: boolean = false; 
  private faceDetectionInterval: any;
  private captureInFlight = 0;
  private captureIdleResolver: (() => void) | null = null;
  private isStoppingCamera = false;
  private isFaceAnalysisRunning = false;

  private lastCaptureTime = 0

  capturedImage: string | null = null;
  capturedImagePreview: string | null = null;
  isImageFrozen: boolean = false;
  isProcessingCapture: boolean = false;
  isProcessingSave: boolean = false;
  isSheetCollapsed: boolean = false;
  faceGuideStyle: Record<string, string> | null = null;

  imageCaptured = false;
  totalToSync = 0;        // cantidad total de fotos pendientes
  syncedCount = 0;
  isSyncing: boolean = false;
  useIndeterminate: boolean = false;
  
  rowsPerPage = 10;
  lastId: string | null = null;
  isLoading = false;
  selectionMode: boolean = false;
  selectedPhotos : Set<string> = new Set<string>();
  pressTimer: any;

  capturedPhotos: PhotoRecordPAE[] = [];
  photoSummary: PhotoRecordPAESummary | null = null;

  displayDialog: boolean = false; // Controla la visibilidad del diálogo
  selectedPhoto: PhotoRecordPAE | null = null; // Foto seleccionada para mostrar en el diálogo
  
  idEntrega: string | null = null; // ID del Registro de Entrega, INdispensable para filtrar fotos
  entregaActual: RecordsDelivery | null = null; // Datos del Registro de Entrega actual

  entregaMinimized: boolean = false;

  gradosList: SelectedGrado[] = [...DEFAULT_SELECTED_GRADOS];
  selectedGrado: number | null = null;
  cursoInput: string = '';

  customModalOptions = {
      cssClass: 'custom-select-modal',
      header: 'Seleccione Colegio ....'
    };

  constructor(
    private cdr: ChangeDetectorRef,
    private messageService: MessageService,
    private photoStorageServicePAE: PhotoStorageServicePAE,
    private repository: PhotosPAERepository,
    private repositoryEntrega: RegistroEntregaPAERepository,
    private route: ActivatedRoute,
    private registroEntregaPaeSync: RegistroEntregaPaeSyncService,
    private gradosRepo: GradosSitioEntregaRepository

   ) {}

  private showCameraToast(
    severity: 'success' | 'info' | 'warn' | 'error',
    summary: string,
    detail: string,
    life = 4500
  ) {
    this.messageService.clear('camera');
    this.messageService.add({ key: 'camera', severity, summary, detail, life });
  }

  toggleEntregaCard() {
    this.entregaMinimized = !this.entregaMinimized;
  }

  toggleSheet() {
    this.isSheetCollapsed = !this.isSheetCollapsed;
  }

  trackByRegistro(index: number, item: any) {
    return item.idPhoto; 
   }

  async ngOnInit() {
    
    this.items= [{ label: 'PAE' },{ label: 'Registro Fotografico' }];
    this.home = { icon: 'pi pi-home', routerLink: '/main' };
    
     this.idEntrega = this.route.snapshot.paramMap.get('id'); 
     this.entregaActual = await this.repositoryEntrega.getRecordsDeliveryPAEById(this.idEntrega!);
    
     if (!this.idEntrega || !this.entregaActual) {
       this.messageService.add({ severity: 'error', summary: 'Error', detail: 'ID de Entrega inválido o no encontrado.' });
       return;
     }
     await this.photoStorageServicePAE.init();   

    await this.loadCapturedPhotos(true);
    await this.loadPhotoSummary();
    await this.loadGradosBySitio();

}

  ngOnDestroy() {
    if (this.cameraActive || this.isStoppingCamera) {
      void this.closeCamera();
    }
  }

  ionViewWillLeave() {
    if (this.cameraActive || this.isStoppingCamera) {
      void this.closeCamera();
    }
  }

private async loadGradosBySitio() {
  if (!this.entregaActual?.idSitioEntrega) return;
  try {
    const gradosBackend = await this.gradosRepo.getGradosBySitioEntrega(this.entregaActual.idSitioEntrega);
    this.gradosList = gradosBackend.length ? gradosBackend : [...DEFAULT_SELECTED_GRADOS];
  } catch (err) {
    console.error('Error cargando grados por sitio de entrega:');
    this.gradosList = [...DEFAULT_SELECTED_GRADOS];
  }
}

onGradoChange(event: any) {
  this.selectedGrado = event.detail.value;
}

// Método para validar fechas y evitar que se tomen fotografias de entregas pasadas.
//Es decir solo se pueden tomar fotos el día de la entrega, ni antes ni después.
isEntregaToday(): boolean {
  if (!this.entregaActual) {
   return false;
  }
  
  const today = new Date();
  const fechaString = this.entregaActual.Fecha;
  
  let entregaDate: Date;
  if (fechaString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = fechaString.split('-').map(Number);
    entregaDate = new Date(year, month - 1, day); 
  } else {
    entregaDate = new Date(fechaString);
  }

  if (isNaN(entregaDate.getTime())) {
    return false;
  }
  const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const entregaNormalized = new Date(entregaDate.getFullYear(), entregaDate.getMonth(), entregaDate.getDate());
  const isToday = todayNormalized.getTime() === entregaNormalized.getTime();
  return isToday;

}

  async openCamera() {
    if (this.cameraActive) return;
    if (!this.entregaActual) return ;

    // Validar que la fecha de entrega sea hoy
    if (!this.isEntregaToday()) {
      this.messageService.add({ 
        severity: 'warn', 
        summary: 'Fecha Inválida', 
        detail: `No se pueden tomar fotos de una entrega que ya pasó (${this.entregaActual.Fecha}). Las fotos deben tomarse el día de la entrega.`,
        life: 5000 
      });
      return;
    }

    this.isStoppingCamera = false;
    this.cameraActive = true;
    this.setCameraOverlay(true);
    this.messageService.clear('camera');

    // Esperar a que el modal se monte antes de iniciar el preview nativo
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    try {
      await this.photoStorageServicePAE.setCapturePosition();
      const cameraPreviewOptions: CameraPreviewOptions = {
        position: 'rear',
        toBack: true,
        enableZoom: false
      };

      await CameraPreview.start(cameraPreviewOptions);
      this.startFaceDetectionLoop();
    } catch (err) {
      this.showCameraToast('error', 'Error de cámara', 'No se pudo iniciar la cámara.');
      // limpiar estado para evitar quedarse con el modal abierto sin preview
      this.cameraActive = false;
      this.setCameraOverlay(false);
      this.photoStorageServicePAE.clearCapturePosition();
    }
  }


  private startFaceDetectionLoop() {
  this.faceDetectionInterval = setInterval(async () => {
    if (!this.cameraActive || this.isStoppingCamera || this.isImageFrozen ||
        this.isProcessingCapture || this.isProcessingSave || this.isFaceAnalysisRunning) return;

    const now = Date.now();
    if (now - this.lastCaptureTime < 500) return;

    try {
      this.isFaceAnalysisRunning = true;
      this.captureInFlight++;
      console.log('Capturando muestra para análisis facial...');
      const result = await CameraPreview.captureSample({ quality: 70 });
      if (!this.cameraActive || this.isStoppingCamera) return;
      const analysis = await FaceQuality.check({
        image: result.value,
        isLivePreview: true
      });

      if (analysis.valid && analysis.faces === 1) {
          this.updateFaceGuide(analysis.faceBounds);
          this.faceDetectedInRealTime = true;
          this.isProcessingCapture = true;
          this.cdr.detectChanges();

          // La muestra solo valida el rostro; la foto final usa la captura
          // de resolucion completa para evitar almacenar un frame borroso.
          const fullResolutionPhoto = await CameraPreview.capture({ quality: 90 });
          if (!this.cameraActive || this.isStoppingCamera) return;

          this.capturedImagePreview = `data:image/jpeg;base64,${fullResolutionPhoto.value}`;
          this.isImageFrozen = true;
          this.isProcessingCapture = false;
          this.cdr.detectChanges();
          //  console.log("Nueva persona detectada, guardando...");
          //  await this.photoStorageServicePAE.savePhoto(result.value, this.entregaActual!);
            
        this.lastCaptureTime = Date.now();} else {
        this.faceDetectedInRealTime = false;
        this.isImageFrozen = false;
        this.faceGuideStyle = null;
        this.cdr.detectChanges();
      
      }
    } catch (error) {
      console.log('se presentaron errores durante la captura facial.');
      if (!this.isStoppingCamera) {
        console.error("Error en la detección de rostro:");
      }
      this.faceDetectedInRealTime = false;
      this.isImageFrozen = false;
      this.isProcessingCapture = false;
    } finally {
      this.isFaceAnalysisRunning = false;
      console.log('Análisis facial completado, preparando para próxima captura...');
      this.captureInFlight = Math.max(0, this.captureInFlight - 1);
      if (this.captureInFlight === 0 && this.captureIdleResolver) {
        this.captureIdleResolver();
        this.captureIdleResolver = null;
      }
    }
  }, 500);
}

private updateFaceGuide(bounds: { x: number; y: number; width: number; height: number } | undefined) {
  if (!bounds) {
    this.faceGuideStyle = null;
    return;
  }

  const paddingX = bounds.width * 0.18;
  const paddingY = bounds.height * 0.22;
  const left = Math.max(0, bounds.x - paddingX);
  const top = Math.max(0, bounds.y - paddingY);
  const width = Math.min(1 - left, bounds.width + paddingX * 2);
  const height = Math.min(1 - top, bounds.height + paddingY * 2);

  this.faceGuideStyle = {
    left: `${left * 100}%`,
    top: `${top * 100}%`,
    width: `${width * 100}%`,
    height: `${height * 100}%`,
    transform: 'none'
  };
}

private waitForCaptureIdle(): Promise<void> {
  if (this.captureInFlight <= 0) return Promise.resolve();
  return new Promise(resolve => {
    this.captureIdleResolver = resolve;
  });
}

// Calcula la distancia matemática entre dos rostros
/* Lógica anterior de comparación de embeddings (AuraFace), ya no utilizada.
private calcularDistanciaEuclidiana(v1: number[], v2: number[]): number {
  if (!v1 || !v2 || v1.length !== v2.length) return Infinity;
  
  let suma = 0;
  for (let i = 0; i < v1.length; i++) {
    suma += Math.pow(v1[i] - v2[i], 2);
  }
  return Math.sqrt(suma);
}

private normalizarVector(vector: number[]): number[] {
  let sumaCuadrados = 0;
  for (let i = 0; i < vector.length; i++) {
    sumaCuadrados += vector[i] * vector[i];
  }
  
  const magnitud = Math.sqrt(sumaCuadrados);
  if (magnitud === 0) return vector; // Prevenir división por cero

  const vectorNormalizado = new Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    vectorNormalizado[i] = vector[i] / magnitud;
  }
  
  return vectorNormalizado;
}

// Verifica si el rostro actual ya fue guardado hace poco
private esRostroDuplicado(nuevoEmbedding: number[]): boolean {
 
  const THRESHOLD = 0.80; 
 console.log('Comparando nuevo embedding con recientes: con ');
  for (const guardado of this.recientesEmbeddings) {
    const distancia = this.calcularDistanciaEuclidiana(guardado, nuevoEmbedding);
      console.log('distancia caclculada:');
    if (distancia < THRESHOLD) {
      console.log('`IA: Duplicado bloqueado (Distancia:)');
      return true; // ¡Es la misma persona!
    }
  }
  
  return false; // Es una persona nueva
}

*/
private stopFaceDetectionLoop() {
  if (this.faceDetectionInterval) {
    clearInterval(this.faceDetectionInterval);
    this.faceDetectionInterval = null;
  }
  this.faceDetectedInRealTime = false;
}


  async captureImage() {
  if (!this.capturedImagePreview) {
    this.showCameraToast('error', 'Error', 'No hay imagen capturada para procesar.');
    return;
  }
  this.isProcessingSave = true;
  this.cdr.detectChanges();

  try {
     const base64Data = this.capturedImagePreview.split(',')[1];
       
     await this.photoStorageServicePAE.savePhoto(base64Data, this.entregaActual!);
     this.resetCameraView();
   
  } catch (error) {
    this.showCameraToast('error', 'Error', 'No se pudo procesar la imagen.');
    this.isProcessingSave = false;
  }
}

async resetCameraView() {
  this.isImageFrozen = false;
  this.capturedImagePreview = null;
  this.faceDetectedInRealTime = false;
  this.faceGuideStyle = null;
  this.isProcessingCapture = false;
  this.isProcessingSave = false;
  this.cdr.detectChanges();
}

  private async loadCapturedPhotos(reset: boolean = false, event?: InfiniteScrollCustomEvent) {
    if (this.isLoading) return; 
    if (!this.idEntrega) return;

    if (reset) {
    this.lastId = null;
    this.capturedPhotos = [];

    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = false;
    }
   }
     this.isLoading = true;
    const nuevosRaw = await this.repository.getAllPhotosByDeliveryPAE(this.idEntrega!,this.rowsPerPage, this.lastId);
    const nuevos = (nuevosRaw || []).map(p => this.normalizePhoto(p));

     if (nuevos.length > 0) {
    this.lastId = nuevos[nuevos.length - 1].idPhoto || null;
    }
     this.capturedPhotos.push(...nuevos);
     
      if (this.infiniteScroll) {
    if (event) {
      await event.target.complete();
    }

    if (nuevos.length < this.rowsPerPage) {
     this.infiniteScroll.disabled = true;
    } else {
     this.infiniteScroll.disabled = false;
    }
    }
    this.isLoading = false;

  }

  async loadPhotoSummary() {
    if (!this.idEntrega) return;
    this.photoSummary = await this.repository.getPhotoSummaryByDeliveryPAE(this.idEntrega);
  }

async syncAll() { 
    if (this.isSyncing) return;
    if (!this.idEntrega) {
      this.messageService.add({ severity: 'warn', summary: 'Sincronizacion', detail: 'No se pudo determinar la entrega actual.' });
      return;
    }

    this.isSyncing = true;
    try {
      this.syncedCount = 0;
      this.totalToSync = 0;
      this.useIndeterminate = true;
      this.messageService.add({
        severity: 'info',
        summary: 'Iniciando Sincronizacion',
        detail: 'Sincronizando registro, archivos y metadata de la entrega activa...'
      });

      const summary = await this.registroEntregaPaeSync.syncAllByEntrega({
        idEntrega: this.idEntrega,
        onFileProgress: (current: number, total: number) => {
          this.syncedCount = current;
          this.totalToSync = total;
          this.useIndeterminate = total > 0 && total < 5;
        }
      });

      const totalPendiente = summary.registrosEntrega.total
        + summary.archivosFotos.total
        + summary.registrosFotos.total;
      const totalFallidos = summary.registrosEntrega.rejected
        + summary.archivosFotos.failed
        + summary.registrosFotos.rejected;
      const detalle = [
        `Registro: ${summary.registrosEntrega.confirmed}/${summary.registrosEntrega.total}`,
        `Archivos: ${summary.archivosFotos.succeeded}/${summary.archivosFotos.total}`,
        `Metadata: ${summary.registrosFotos.confirmed}/${summary.registrosFotos.total}`
      ].join(' | ');

      if (totalPendiente === 0) {
        this.messageService.add({
          severity: 'info',
          summary: 'Sincronizacion',
          detail: 'El registro activo y sus fotos ya estaban sincronizados.',
        });
      } else if (totalFallidos > 0) {
        this.messageService.add({
          severity: 'warn',
          summary: 'Sincronizacion completada con errores',
          detail: `${detalle}. Fallidos: ${totalFallidos}.`,
          life: 5000
        });
      } else {
        this.messageService.add({
          severity: 'success',
          summary: 'Sincronizacion Exitosa',
          detail: detalle,
          life: 5000
        });
      }
    } catch (err) {
      console.error('Error general durante la sincronizacion:');
      this.messageService.add({
        severity: 'error',
        summary: 'Error de Sincronizacion',
        detail: 'Ocurrio un error inesperado al preparar la sincronizacion.',
      });
    } finally {
      this.isSyncing = false;
      await this.loadCapturedPhotos(true);
      await this.loadPhotoSummary();
    }

}  
 async closeCamera() {
  console.log('Iniciando cierre de cámara...');
  if (this.isStoppingCamera) return;
   this.isStoppingCamera = true;
  ;

  try {
    // Esperamos a que termine la captura, pero máximo 1 segundo
    // Si en 1 segundo no termina, forzamos el cierre de todos modos
   this.stopFaceDetectionLoop()
    await Promise.race([
      this.waitForCaptureIdle(),
      new Promise(resolve => setTimeout(resolve, 500))
    ]);

    await CameraPreview.stop();
  } catch (err) {
    console.error('Error al detener cámara nativa:');
  } finally {
    // ESTO ES LO QUE REALMENTE CIERRA LA VISTA:
    this.cameraActive = false; 
    this.isStoppingCamera = false;
    this.isImageFrozen = false;
    this.isProcessingCapture = false;
    this.isFaceAnalysisRunning = false;
    this.capturedImagePreview = null;
    this.faceGuideStyle = null;
    this.setCameraOverlay(false); // Quita el fondo transparente
    this.cdr.detectChanges(); // Fuerza a Angular a ocultar el div/modal
    await this.loadCapturedPhotos(true);
    await this.loadPhotoSummary();

  }
}

    private setCameraOverlay(active: boolean) {
      //estilos definidos en global styles.css para mostrar/ocultar elementos cuando la cámara está activa
      document.body.classList.toggle('camera-open', active);
    }

  viewPhoto(photo: PhotoRecordPAE) {
     if(this.selectionMode){
       this.toggleSelection(photo);
     } else {
       this.selectedPhoto = photo; 
       this.displayDialog = true; 
     }
  }

  closeDialog() {
  this.displayDialog = false; 
  this.selectedPhoto = null; 
}

async loadMore(event: InfiniteScrollCustomEvent) {

   if (this.isLoading) {
    event.target.complete();
    return;
  }
  
   await this.loadCapturedPhotos(false, event);
  }

  startPress(photo: PhotoRecordPAE) {

  this.pressTimer = setTimeout(() => {

    this.selectionMode = true;

    this.toggleSelection(photo);

  }, 600); 

}

  isSelected(photo: PhotoRecordPAE): boolean {
    const id = photo.idPhoto;
    return !!id && this.selectedPhotos.has(id);
  }

toggleSelection(photo: PhotoRecordPAE){

  if(photo.syncedPhoto === 1){
    return; 
  }

  const id = photo.idPhoto;
  if (!id) {
    return;
  }

  if(this.selectedPhotos.has(id)){
    this.selectedPhotos.delete(id);
  } else {
    this.selectedPhotos.add(id);
  }

}


cancelPress(){
  clearTimeout(this.pressTimer);
}

toggleSelectAll() {
  const selectable = this.capturedPhotos.filter(p => !p.syncedPhoto);
  if (this.selectedPhotos.size === selectable.length) {
    this.selectedPhotos.clear();
  } else {
    for (const p of selectable) {
      if (p.idPhoto) {
        this.selectedPhotos.add(p.idPhoto);
      }
    }
  }
}

get allSelected(): boolean {
  const selectable = this.capturedPhotos.filter(p => !p.syncedPhoto);
  return selectable.length > 0 && this.selectedPhotos.size === selectable.length;
}

clearSelection(){
  this.selectedPhotos.clear();
  this.selectionMode = false;
}


async deleteSelected(){
  const ids = Array.from(this.selectedPhotos);
  if (ids.length === 0) return;

  const deletedIds: string[] = [];
  let errorCount = 0;

  for (const id of ids) {
    const photo = this.capturedPhotos.find(p => p.idPhoto === id);
    if (!photo?.idPhoto) continue;

    try {
      await this.photoStorageServicePAE.deleteFileFromDevice(photo.filePath);
      await this.repository.markDeletePhotoPAE(photo.idPhoto);
      await this.loadPhotoSummary();
      deletedIds.push(photo.idPhoto);
    } catch (err) {
      errorCount++;
      console.error('Error eliminando foto seleccionada:');
    }
  }

  if (deletedIds.length > 0) {
    const deletedSet = new Set(deletedIds);
    this.capturedPhotos = this.capturedPhotos.filter(p => !p.idPhoto || !deletedSet.has(p.idPhoto));
    for (const deletedId of deletedIds) {
      this.selectedPhotos.delete(deletedId);
    }

    if (this.selectedPhoto?.idPhoto && deletedSet.has(this.selectedPhoto.idPhoto)) {
      this.closeDialog();
    }
  }

  if (this.selectedPhotos.size === 0) {
    this.selectionMode = false;
  }

  if (deletedIds.length > 0 && errorCount === 0) {
    this.messageService.add({
      severity: 'success',
      summary: 'Eliminación',
      detail: `${deletedIds.length} foto(s) eliminada(s).`,
      life: 2500
    });
  } else if (deletedIds.length > 0 && errorCount > 0) {
    this.messageService.add({
      severity: 'warn',
      summary: 'Eliminación parcial',
      detail: `${deletedIds.length} eliminada(s), ${errorCount} fallaron.`,
      life: 5000
    });
  } else if (deletedIds.length === 0 && errorCount > 0) {
    this.messageService.add({
      severity: 'error',
      summary: 'Eliminación',
      detail: 'No se pudo eliminar ninguna foto seleccionada.',
      life: 5000
    });
  }

 }


   private coerceNumber(value: unknown, defaultValue = 0): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : defaultValue;
    }
    if (typeof value === 'boolean') return value ? 1 : 0;
    return defaultValue;
  }

  private normalizePhoto(raw: PhotoRecordPAE): PhotoRecordPAE {
    const anyRaw = raw as unknown as Record<string, unknown>;
    return {
      ...raw,
      idPhoto: anyRaw['idPhoto'] != null ? String(anyRaw['idPhoto']) : raw.idPhoto,
      idRegistroEntrega: anyRaw['idRegistroEntrega'] != null ? String(anyRaw['idRegistroEntrega']) : raw.idRegistroEntrega,
      syncedPhoto: this.coerceNumber(anyRaw['syncedPhoto']),
      deletedPhoto: this.coerceNumber(anyRaw['deletedPhoto']),
      syncedDB: this.coerceNumber(anyRaw['syncedDB']),
      deleteRegistro: this.coerceNumber(anyRaw['deleteRegistro']),
    };
  }


}
