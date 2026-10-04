import { Component, ViewChild, OnDestroy, OnInit } from '@angular/core';
import { ChangeDetectorRef } from '@angular/core';
import { DatePipe, CommonModule } from '@angular/common';
import { ActivatedRoute,RouterLink } from '@angular/router';
import { CameraPreview, CameraPreviewOptions } from '@capacitor-community/camera-preview';
import { registerPlugin } from '@capacitor/core';


import { PhotoStorageServicePME} from '../../../core/services/photoRecordPME.service';
import { RegistroServicioPmeSyncService } from '../../../core/services/registroServicioPmeSync.service';
import { PhotosPMERepository } from '../../../core/repositories/photosPME.repository'; 
import { RegistroServicioPMERepository} from '../../../core/repositories/RegistroServicioPME.repository'; 
import { RecordsService} from '../../../core/models/registroServicioPME.model';
import { PhotoRecordPME, PhotoRecordPMESummary} from '../../../core/models/photoRecordPME.model';

import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { MenuItem } from 'primeng/api';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

import { IonButton,  IonButtons, IonContent, IonHeader,  IonModal,   IonTitle,  IonToolbar,
         IonInfiniteScroll, IonInfiniteScrollContent,  InfiniteScrollCustomEvent,  IonCard,  IonCardContent,IonChip,
         IonCheckbox } from '@ionic/angular/standalone';

const FaceQuality = registerPlugin<any>('FaceQuality');

@Component({
  selector: 'app-photo-record',
  standalone: true,
  imports: [IonButton,  IonButtons, IonContent, IonHeader,  IonModal,   IonTitle,  IonToolbar,
         IonInfiniteScroll, IonInfiniteScrollContent,  IonCard,  IonCardContent,IonChip,
          IonCheckbox, ToastModule, ButtonModule,  ToastModule, ConfirmDialogModule,  DatePipe, 
          CommonModule, ProgressBarModule,   BreadcrumbModule, ButtonModule,   RouterLink],
  providers: [ConfirmationService, MessageService],
  templateUrl: '../photoRecordPme/photoRecordPme.component.html',
  styleUrls: ['../photoRecordPme/photoRecordPme.component.css'],
 })

export class PhotoRecordPmeComponent implements OnInit, OnDestroy {
  // Breadcrumb
  items: MenuItem[] | undefined;
  home: MenuItem | undefined;

  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;
  // Variables para manejo de fotos
  cameraActive :  boolean = false;
  faceDetectedInRealTime: boolean = false;
  private faceDetectionInterval: ReturnType<typeof setInterval> | null = null;
  private captureInFlight = 0;
  private captureIdleResolver: (() => void) | null = null;
  private isStoppingCamera = false;
  private isFaceAnalysisRunning = false;
  private lastCaptureTime = 0;

  capturedImage: string | null = null;
  capturedImagePreview: string | null = null;
  isImageFrozen: boolean = false;
  isProcessingCapture: boolean = false;
  isProcessingSave: boolean = false;
  isSheetCollapsed: boolean = false;
  faceGuideStyle: Record<string, string> | null = null;

  totalToSync = 0;        
  syncedCount = 0;
  isSyncing: boolean = false;
  useIndeterminate: boolean = false;

  rowsPerPage = 10;
  lastId: string | null = null;
  isLoading = false;
  selectionMode: boolean = false;
  selectedPhotos : Set<string> = new Set<string>();
  pressTimer: any;

  capturedPhotos: PhotoRecordPME[] = [];
  photoSummary: PhotoRecordPMESummary | null = null;

  displayDialog: boolean = false; 
  selectedPhoto: PhotoRecordPME | null = null; // Foto seleccionada para mostrar en el diálogo

 
  idServicio: string | null = null; 
  servicioActual: RecordsService | null = null; 

  servicioMinimized: boolean = false;

  constructor(
    private cdr: ChangeDetectorRef,
    private messageService: MessageService,
    private photoStorageServicePME: PhotoStorageServicePME,
    private repository: PhotosPMERepository,
    private repositoryServicio: RegistroServicioPMERepository,
    private route: ActivatedRoute,
    private registroServicioPmeSync: RegistroServicioPmeSyncService
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

  toggleServicioCard() {
    this.servicioMinimized = !this.servicioMinimized;
  }

  toggleSheet() {
    this.isSheetCollapsed = !this.isSheetCollapsed;
  }

  trackByRegistro(index: number, item: any) {
    return item.idPhoto; 
   }

  async ngOnInit() {
    
    this.items= [{ label: 'PME' },{ label: 'Registro Fotografico' }];
    this.home = { icon: 'pi pi-home', routerLink: '/main' };
    
     this.idServicio = this.route.snapshot.paramMap.get('id'); 
     this.servicioActual = await this.repositoryServicio.getRecordsServicioPMEById(this.idServicio!);
        
     if (!this.idServicio || !this.servicioActual) {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'ID de Servicio inválido o no encontrado.' });
          return;
        }

     await this.photoStorageServicePME.init();  

    await this.loadCapturedPhotos(true);
    await this.loadPhotoSummary();
    
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

isServicioToday(): boolean {
  if (!this.servicioActual) {
   return false;
  }
  
  const today = new Date();
  const fechaString = this.servicioActual.Fecha;
  
  let servicioDate: Date;
  if (fechaString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = fechaString.split('-').map(Number);
    servicioDate = new Date(year, month - 1, day); 
  } else {
    servicioDate = new Date(fechaString);
  }

  if (isNaN(servicioDate.getTime())) {
    return false;
  }
  const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const servicioNormalized = new Date(servicioDate.getFullYear(), servicioDate.getMonth(), servicioDate.getDate());
  const isToday = todayNormalized.getTime() === servicioNormalized.getTime();
  return isToday;

}

  async openCamera() {
    if (this.cameraActive) return;
    if (!this.servicioActual) return ;

    // Validar que la fecha de servicio sea hoy
    if (!this.isServicioToday()) {
      this.messageService.add({ 
        severity: 'warn', 
        summary: 'Fecha Inválida', 
        detail: `No se pueden tomar fotos de un servicio prestado (${this.servicioActual.Fecha}). Las fotos deben tomarse el mismos día del servicio.`,
        life: 5000 
      });
      return;
    }
    
    this.isStoppingCamera = false;
    this.cameraActive = true;
    this.setCameraOverlay(true);
    this.messageService.clear('camera');

    // Esperar a que el modal se monte antes de iniciar el preview nativo.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

    try {
      await this.photoStorageServicePME.setCapturePosition();
      const cameraPreviewOptions: CameraPreviewOptions = {
        position: 'rear',
        toBack: true,
        enableZoom: false
      };

      await CameraPreview.start(cameraPreviewOptions);
      this.startFaceDetectionLoop();
    } catch (error) {
      console.error('Error al iniciar la camara PME:', error);
      this.showCameraToast('error', 'Error de camara', 'No se pudo iniciar la camara.');
      this.cameraActive = false;
      this.setCameraOverlay(false);
      this.photoStorageServicePME.clearCapturePosition();
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

        const sample = await CameraPreview.captureSample({ quality: 70 });
        if (!this.cameraActive || this.isStoppingCamera) return;

        const analysis = await FaceQuality.check({
          image: sample.value,
          isLivePreview: true
        });

        if (analysis.valid && analysis.faces === 1) {
          this.updateFaceGuide(analysis.faceBounds);
          this.faceDetectedInRealTime = true;
          this.isProcessingCapture = true;
          this.cdr.detectChanges();

          // La muestra valida el rostro; la imagen almacenada se toma a
          // resolucion completa para conservar la nitidez.
          const fullResolutionPhoto = await CameraPreview.capture({ quality: 90 });
          if (!this.cameraActive || this.isStoppingCamera) return;

          this.capturedImagePreview = `data:image/jpeg;base64,${fullResolutionPhoto.value}`;
          this.isImageFrozen = true;
          this.isProcessingCapture = false;
          this.lastCaptureTime = Date.now();
          this.cdr.detectChanges();
        } else {
          this.faceDetectedInRealTime = false;
          this.isImageFrozen = false;
          this.faceGuideStyle = null;
          this.cdr.detectChanges();
        }
      } catch (error) {
        if (!this.isStoppingCamera) {
          console.error('Error en la deteccion de rostro PME:', error);
        }
        this.faceDetectedInRealTime = false;
        this.isImageFrozen = false;
        this.isProcessingCapture = false;
        this.faceGuideStyle = null;
      } finally {
        this.isFaceAnalysisRunning = false;
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

  private stopFaceDetectionLoop() {
    if (this.faceDetectionInterval) {
      clearInterval(this.faceDetectionInterval);
      this.faceDetectionInterval = null;
    }
    this.faceDetectedInRealTime = false;
  }

  async captureImage() {
    if (!this.capturedImagePreview) {
      this.showCameraToast('error', 'Error', 'No hay una imagen valida para almacenar.');
      return;
    }
    if (!this.cameraActive) {
      this.showCameraToast('warn', 'Camara inactiva', 'Abre la camara antes de almacenar una foto.');
      return;
    }   
    if (!this.idServicio || !this.servicioActual) {
      this.showCameraToast('error', 'Error', 'El servicio activo no es valido.');
      return;
    }
    
    try {
      this.isProcessingSave = true;
      this.cdr.detectChanges();

      const base64Data = this.capturedImagePreview.split(',')[1];
      await this.photoStorageServicePME.savePhoto(base64Data, this.servicioActual);
      await this.resetCameraView();
    } catch (error) {
      console.error('Error al almacenar la foto PME:', error);
      this.isProcessingSave = false;
      this.cdr.detectChanges();
      this.showCameraToast('error', 'Error', 'No se pudo procesar la imagen.');
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
    if (!this.idServicio) return;

    if (reset) {
    this.lastId = null;
    this.capturedPhotos = [];

    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = false;
    }
   }
     this.isLoading = true;
    const nuevosRaw = await this.repository.getAllPhotosByServicioPME(this.idServicio!,this.rowsPerPage, this.lastId);
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
    if (!this.idServicio) return;
    this.photoSummary = await this.repository.getPhotoSummaryByServicioPME(this.idServicio);
  }

  async syncAll() { 
      if (this.isSyncing) return;
      if (!this.idServicio || !this.servicioActual) {
        this.messageService.add({ severity: 'warn', summary: 'Sincronización', detail: 'No se pudo determinar el servicio actual.' });
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
        detail: 'Sincronizando registro, archivos y metadata del servicio activo...'
      });

      const summary = await this.registroServicioPmeSync.syncAllByServicio({
        idServicio: this.idServicio,
        onFileProgress: (current, total) => {
          this.syncedCount = current;
          this.totalToSync = total;
          this.useIndeterminate = total > 0 && total < 5;
        }
      });

      const totalPendiente = summary.registrosServicio.total
        + summary.archivosFotos.total
        + summary.registrosFotos.total;
      const totalFallidos = summary.registrosServicio.rejected
        + summary.archivosFotos.failed
        + summary.registrosFotos.rejected;
      const detalle = [
        `Servicio: ${summary.registrosServicio.confirmed}/${summary.registrosServicio.total}`,
        `Archivos: ${summary.archivosFotos.succeeded}/${summary.archivosFotos.total}`,
        `Metadata: ${summary.registrosFotos.confirmed}/${summary.registrosFotos.total}`
      ].join(' | ');

      if (totalPendiente === 0) {
        this.messageService.add({
          severity: 'info',
          summary: 'Sincronizacion',
          detail: 'El servicio activo y sus fotos ya estaban sincronizados.'
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
          summary: 'Sincronizacion exitosa',
          detail: detalle,
          life: 5000
        });
      }
      } catch (err) {
        // Este error se capturaría si getPendingPhotos falla, antes del bucle paralelo.
        console.error('Error general durante la sincronización:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error de Sincronización',
          detail: 'Ocurrió un error inesperado al preparar la subida.',
        });
      } finally {
        this.isSyncing = false;
        // Refrescar la lista/resumen para mostrar el estado actualizado
        await this.loadCapturedPhotos(true);
        await this.loadPhotoSummary();
      }
  
  }  
 

 async closeCamera() {
    if (this.isStoppingCamera) return;
    this.isStoppingCamera = true;

    try {
      this.stopFaceDetectionLoop();
      await Promise.race([
        this.waitForCaptureIdle(),
        new Promise(resolve => setTimeout(resolve, 500))
      ]);

      await CameraPreview.stop();
    } catch (error) {
      console.error('Error al detener la camara nativa PME:', error);
    } finally {
      this.cameraActive = false;
      this.isStoppingCamera = false;
      this.isImageFrozen = false;
      this.isProcessingCapture = false;
      this.isProcessingSave = false;
      this.isFaceAnalysisRunning = false;
      this.capturedImagePreview = null;
      this.faceGuideStyle = null;
      this.photoStorageServicePME.clearCapturePosition();
      this.setCameraOverlay(false);
      this.cdr.detectChanges();
      await this.loadCapturedPhotos(true);
      await this.loadPhotoSummary();
    }
  }

    private setCameraOverlay(active: boolean) {
      //estilos definidos en global styles.css para mostrar/ocultar elementos cuando la cámara está activa
      document.body.classList.toggle('camera-open', active);
    }
    
  viewPhoto(photo: PhotoRecordPME) {
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

  startPress(photo: PhotoRecordPME) {

  this.pressTimer = setTimeout(() => {

    this.selectionMode = true;

    this.toggleSelection(photo);

  }, 600); 

}

  isSelected(photo: PhotoRecordPME): boolean {
    const id = photo.idPhoto;
    return !!id && this.selectedPhotos.has(id);
  }

toggleSelection(photo: PhotoRecordPME){

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
  const selectable = this.capturedPhotos.filter(photo => !photo.syncedPhoto);
  if (this.selectedPhotos.size === selectable.length) {
    this.selectedPhotos.clear();
    return;
  }

  for (const photo of selectable) {
    if (photo.idPhoto) {
      this.selectedPhotos.add(photo.idPhoto);
    }
  }
}

get allSelected(): boolean {
  const selectable = this.capturedPhotos.filter(photo => !photo.syncedPhoto);
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
      await this.photoStorageServicePME.deleteFileFromDevice(photo.filePath);
      await this.repository.markDeletePhotoPME(photo.idPhoto);
      await this.loadPhotoSummary();
      deletedIds.push(photo.idPhoto);
    } catch (err) {
      errorCount++;
      console.error('Error eliminando foto seleccionada:', err);
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

  private normalizePhoto(raw: PhotoRecordPME): PhotoRecordPME {
    const anyRaw = raw as unknown as Record<string, unknown>;
    return {
      ...raw,
      idPhoto: anyRaw['idPhoto'] != null ? String(anyRaw['idPhoto']) : raw.idPhoto,
      idRegistroServicio: anyRaw['idRegistroServicio'] != null ? String(anyRaw['idRegistroServicio']) : raw.idRegistroServicio,
      syncedPhoto: this.coerceNumber(anyRaw['syncedPhoto']),
      deletedPhoto: this.coerceNumber(anyRaw['deletedPhoto']),
      syncedDB: this.coerceNumber(anyRaw['syncedDB']),
      deleteRegistro: this.coerceNumber(anyRaw['deleteRegistro']),
    };
  }



}
