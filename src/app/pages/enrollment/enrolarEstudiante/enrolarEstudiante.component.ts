import {AfterViewInit, Component, ElementRef, ViewChild,OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { CameraPreview, CameraPreviewOptions } from '@capacitor-community/camera-preview';
import { registerPlugin } from '@capacitor/core';
import { ChangeDetectorRef } from '@angular/core';
import { RegistroMatriculaDTO,
  addFaceEstudianteDTO,
  DeleteFacePersonDto,
  DeletePersonDto,
  FacesEstudianteDTO,
  IdPersonFacesDto,
  SasResponse,PersonsDirectoryDto} from '../../../core/models/enrolarEstudiante.model'; 
import { EnrolarEstudianteService} from '../../../core/services/enrolarEstudiante.services'; 
import { EstudianteSelectService } from '../../../core/services/estudianteSelect.sevice';
import { EstudianteService } from '../../../core/services/estudiante.service';
import { RouterModule,Router } from '@angular/router';
import { DialogModule } from 'primeng/dialog';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ToolbarModule } from 'primeng/toolbar';
import { InputTextModule } from 'primeng/inputtext';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ActivatedRoute } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { MatriculaRepository } from '../../../core/repositories/matricula.repository';
import { VectoresRepository } from '../../../core/repositories/vectores.repository';
import { finalize } from 'rxjs';
import { addIcons } from 'ionicons';
import { calendarOutline, checkmarkCircleOutline,closeCircleOutline} from 'ionicons/icons';

const FaceQuality = registerPlugin<any>('FaceQuality');

@Component({
  selector: 'app-enrolar-estudiante',
  imports: [FormsModule, TableModule, ButtonModule, ToolbarModule, IconFieldModule, InputIconModule, ConfirmDialogModule, ToastModule, InputTextModule, DialogModule, HttpClientModule, BreadcrumbModule, RouterModule, IonicModule,DatePipe],
  standalone: true,
  providers: [ConfirmationService, MessageService, EnrolarEstudianteService],
  templateUrl: './enrolarEstudiante.component.html',
  styleUrls: ['./enrolarEstudiante.component.css']
})

export class EnrolarEstudianteComponent  {
    private sasCache: { [idEstudiante: string]: SasResponse } = {};
    private safeImageUrls: { [key: string]: SafeUrl } = {}; // Cache para URLs seguras
    
   cameraActive :  boolean = false;
   faceDetectedInRealTime: boolean = false; 
    private faceDetectionInterval: any;
    private isCapturingAutomatically: boolean = false;
    private lastCaptureTime = 0
    private lastPoints: any[] = [];
    private embeddingActual: number[] | null = null;

    capturedImage: File | null = null;
    imageCaptured = false;

    matricula: RegistroMatriculaDTO = this.createEmptyRegistroMatricula();
    addFaceEstudiante  : addFaceEstudianteDTO = {} as addFaceEstudianteDTO;
    facesEstudiante: FacesEstudianteDTO  [] = [];
    selectedFace: FacesEstudianteDTO | null = null;
    deletingFacePersistedId: string | null = null;
    imagenSeleccionada: string | null = null;
    mostrarDialogoImagen = false;
    mostrarRecognitionDialog = false;
    perID: string = '';
    loading: boolean = false;
    busquedaRealizada = false; 
    mostrarInfoCompleta = false;

    items: MenuItem[] | undefined;
    home: MenuItem | undefined;
    isSaving: boolean = false; 
    isDeletingPerson = false;
    personsDialogVisible = false;
    loadingPersonsIdPersonDirectory: string | null = null;
    personsDirectorySeleccionado: PersonsDirectoryDto | null = null;
    personsDirectoryUserDataJson = '';
    facesPersonDialogVisible = false;
    loadingFacesPersonIdPersonDirectory: string | null = null;
    facesPersonSeleccionado: IdPersonFacesDto | null = null;
    facesPersonJson = '';

  constructor(
    private cdr: ChangeDetectorRef,
    private enrolarEstudianteService: EnrolarEstudianteService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private estudianteSelect: EstudianteSelectService,
    private sanitizer: DomSanitizer,
    private router: Router,
    private matriculaRepository: MatriculaRepository,
    private vectoresRepository: VectoresRepository,
    private estudianteService: EstudianteService
    
   ) {  addIcons({calendarOutline,checkmarkCircleOutline,closeCircleOutline});}

    private showCameraToast(
    severity: 'success' | 'info' | 'warn' | 'error',
    summary: string,
    detail: string,
    life = 4500
  ) {
    this.messageService.clear('camera');
    this.messageService.add({ key: 'camera', severity, summary, detail, life });
  }

   ngOnInit() {

    this.items= [{ label: 'PAE' },{ label: 'Enrolamiento' }, { label: 'Agregar Rostros' }];
    this.home = { icon: 'pi pi-home', routerLink: ['/main'] };
    this.estudianteSelect.estudiante$.subscribe(est => {
    
        if (est) {
          this.mostrarInfoCompleta = false;
          this.matricula = this.toRegistroMatricula(est);
          this.perID = this.matricula.perID;
          if (this.matricula.idPersonDirectory) {
            this.getFacesEstudiante();
          }
        }else {
          // Limpia el formulario
          this.mostrarInfoCompleta = false;
          this.matricula = this.createEmptyRegistroMatricula();
          this.perID = "";
        }
        });
  
  }
   
  goBack() {
    this.router.navigate(['enrollment/estudiantes'], { queryParamsHandling: 'preserve' });
  }

  //   async ngAfterViewInit() {
  //     this.video = this.videoElement.nativeElement;
  //     this.canvas = this.canvasElement.nativeElement;
  //     this.context = this.canvas.getContext('2d');
  //   }

  //  ngOnDestroy() {     
  //   if (this.video && this.video.srcObject) {
  //     const stream = this.video.srcObject as MediaStream;
  //     stream.getTracks().forEach(track => track.stop());
  //     this.video.srcObject = null;
  //   }
  // }

   async openCamera() {
    if (this.cameraActive) return;
    if (!this.perID) return ;

    this.cameraActive = true;
    this.setCameraOverlay(true);
    this.messageService.clear('camera');

    // Esperar a que el modal se monte antes de iniciar el preview nativo
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
      this.showCameraToast('error', 'Error de cámara', 'No se pudo iniciar la cámara.');
      // limpiar estado para evitar quedarse con el modal abierto sin preview
      this.cameraActive = false;
      this.setCameraOverlay(false);
     }
  }

  private startFaceDetectionLoop() {
  this.faceDetectionInterval = setInterval(async () => {
    if (!this.cameraActive || this.isCapturingAutomatically ) return;

       const now = Date.now();
      if (now - this.lastCaptureTime < 1500) return;

    try {
 
      const result = await CameraPreview.captureSample({ quality: 85 });
      const analysis = await FaceQuality.check({
        image: result.value
      });

      if (analysis.valid) {
          
        this.isCapturingAutomatically = true; 
        this.faceDetectedInRealTime = true; 
        this.embeddingActual = analysis.embedding ? this.normalizarVector(analysis.embedding) : null;
        this.cdr.detectChanges();
        console.log("Nueva persona detectada, guardando...");
        //await this.photoStorageServicePAE.savePhoto(result.value, this.entregaActual!);
        
        this.lastPoints = analysis.meshPoints;
        this.lastCaptureTime = Date.now();

           // Pausa de 2 segundos antes de permitir otra captura
      } else {
        this.faceDetectedInRealTime = false;
        this.embeddingActual = null;
        this.cdr.detectChanges();
      
      }
    } catch (error) {
      console.error("Error en la detección de rostro:");
      this.faceDetectedInRealTime = false;
      this.isCapturingAutomatically = false;
      this.embeddingActual = null;
    }
  }, 500);
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

compareMeshes(oldPoints: any[], newPoints: any[]): boolean {
  if (!oldPoints || oldPoints.length === 0) return false;
  
 
  const dist = Math.sqrt(
    Math.pow(oldPoints[0].x - newPoints[0].x, 2) + 
    Math.pow(oldPoints[0].y - newPoints[0].y, 2)
  );
  
  return dist < 60; // Umbral de movimiento
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
       // await this.loadCapturedPhotos(true);
       // await this.loadPhotoSummary();
      }
  }
    private setCameraOverlay(active: boolean) {
      //estilos definidos en global styles.css para mostrar/ocultar elementos cuando la cámara está activa
      document.body.classList.toggle('camera-open', active);
    }

     async captureImage() {
      if (!this.faceDetectedInRealTime) {
        this.showCameraToast('warn', 'Atención', 'No se detecta un rostro claro para capturar.');
        return;
      }
    
      try {
        this.imageCaptured = true;
        const result = await CameraPreview.capture({ quality: 85 });
        
      //   // Validación final de seguridad
      //   const analysis = await FaceQuality.check({ image: result.value });
    
      //  // if (!analysis.valid || analysis.faces !== 1 || !analysis.eyesOpen) {
      //   if (analysis.faces === 0) {
      //     this.imageCaptured = false;
      //     this.isCapturingAutomatically = false;
      //     this.faceDetectedInRealTime = false;
      //     this.showCameraToast('warn', 'Calidad insuficiente', 'Asegúrate de que el rostro sea visible y los ojos estén abiertos.');
      //     return;
      //   }
    
        this.capturedImage = this.base64ToFile(result.value, `captured_${Date.now()}.jpg`);
        this.guardarFaceEstudiante();
        
    
      } catch (error) {
        this.imageCaptured = false;
        this.isCapturingAutomatically = false;
        this.faceDetectedInRealTime = false;
        this.showCameraToast('error', 'Error', 'No se pudo procesar la imagen.');
      }
    }

base64ToFile(data: string | Blob, filename: string, contentType = 'image/jpeg'): File {
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
    
  // detenerCamara(): void {
  //    this.mostrarRecognitionDialog = false; 
  //    this.ngOnDestroy();
  // }
  //   captureImage() {
  //     if (this.context) {
        
  //       this.canvas.width = this.video.videoWidth;
  //       this.canvas.height = this.video.videoHeight;
  //       this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
  //       this.canvas.toBlob((blob) => {
  //         if (blob) {
  //           this.capturedImage = new File([blob], 'captured_image.jpg', { type: 'image/jpeg' });
  //           this.imageCaptured = true;
  //         }
  //       }, 'image/jpeg');
  //     }
  //  } 

    // retakePhoto() {
    // this.imageCaptured = false;
    // this.capturedImage = null;
    // this.context?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // }


  guardarEstudiante(): void {
    const matricula = this.buildRegistroMatricula();

    if (!matricula.perID) {
      this.messageService.add({
        severity:'warn',
        summary: 'Advertencia',
        detail: 'Para guardar el estudiante se requiere un PerID valido.'
      });
      return;
    }

    if (!this.hasDatosMatricula(matricula)) {
      this.messageService.add({
        severity:'warn',
        summary: 'Advertencia',
        detail: 'No se encontraron datos de matricula para enviar. Vuelva a seleccionar el estudiante desde el listado.'
      });
      return;
    }

    this.loading = true;
    this.enrolarEstudianteService.guardarEstudiante(matricula).subscribe({

      next: async (response : RegistroMatriculaDTO) => {
        const matriculaActualizada = {
          ...matricula,
          idPersonDirectory: response.idPersonDirectory || matricula.idPersonDirectory,
          fechaCreacion: response.fechaCreacion || matricula.fechaCreacion
        };
        this.matricula = matriculaActualizada;
        this.perID = this.matricula.perID;
         this.estudianteService.actualizarEstudianteEnMemoria(matricula.perID, {
          idPersonDirectory: matriculaActualizada.idPersonDirectory,
          fechaCreacion: matriculaActualizada.fechaCreacion
        });
        this.estudianteSelect.setEstudiante(matriculaActualizada);
        this.cdr.detectChanges();
        this.messageService.add({
          severity:'success', 
          summary: 'Éxito', 
          detail: `Estudiante con PER_ID ${this.matricula.perID} almacenado en la base de datos de reconocimiento facial.`});
        
        try {
          await this.matriculaRepository.saveMatricula(this.matricula);
        } catch (error) {
          this.messageService.add({
            severity:'warn',
            summary: 'Advertencia',
            detail: 'El estudiante fue guardado remotamente, pero no se pudo registrar la matricula en la base local.'
          });
        } finally {
          this.loading = false;
        }
      },
      error: (err) => {
        this.messageService.add({
          severity:'error', 
          summary: 'Error', 
          detail: `Error al guardar estudiante.  
                   ${err.mensaje || 'No se pudo identificar la causa del error, por favor comuníquese con soporte.'}`});
        this.loading = false;
      }
      
    });
  }

  private buildRegistroMatricula(): RegistroMatriculaDTO {
    return this.toRegistroMatricula(this.matricula);
  }

  private toRegistroMatricula(source: Partial<RegistroMatriculaDTO>): RegistroMatriculaDTO {
    return {
      perID: source.perID ?? '',
      descripcionAbreviada: source.descripcionAbreviada ?? '',
      numeroDocumento: source.numeroDocumento ?? '',
      apellido1: source.apellido1 ?? '',
      apellido2: source.apellido2 ?? '',
      nombre1: source.nombre1 ?? '',
      nombre2: source.nombre2 ?? '',
      fechaNacimiento: source.fechaNacimiento ?? '',
      genero: source.genero ?? '',
      grado: source.grado ?? '',
      idPersonDirectory: source.idPersonDirectory ?? '',
      fechaCreacion: source.fechaCreacion ?? ''
    };
  }

  private hasDatosMatricula(matricula: RegistroMatriculaDTO): boolean {
    return [
      matricula.descripcionAbreviada,
      matricula.numeroDocumento,
      matricula.apellido1,
      matricula.apellido2,
      matricula.nombre1,
      matricula.nombre2,
      matricula.fechaNacimiento,
      matricula.genero,
      matricula.grado
    ].some(value => String(value ?? '').trim() !== '');
  }

  private createEmptyRegistroMatricula(): RegistroMatriculaDTO {
    return {
      perID: '',
      descripcionAbreviada: '',
      numeroDocumento: '',
      apellido1: '',
      apellido2: '',
      nombre1: '',
      nombre2: '',
      fechaNacimiento: '',
      genero: '',
      grado: '',
      idPersonDirectory: '',
      fechaCreacion: ''
    };
  }

  
    onPerIDChange() {
      // Limpia todos los campos excepto perID
      this.matricula = {
        ...this.matricula,
        idPersonDirectory: "",
        descripcionAbreviada: "",
        numeroDocumento: "",
        apellido1: "",
        apellido2: "",
        nombre1: "",
        nombre2: "",
        fechaNacimiento: "",
        genero: "",
        grado: "",
        fechaCreacion: "",
      };
      this.facesEstudiante = [];
      this.selectedFace = null;
    }

   
   //Este metodo esta enfocado a consultar la informacion del personIdDirectory en Api Face Azure...
  verPersons(): void {
    if (!this.matricula.idPersonDirectory) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'El estudiante no cuenta con IdPersonDirectory para consultar en Face Api de Azure.'
      });
      return;
    }

    const idPersonDirectory = this.matricula.idPersonDirectory;
    this.loadingPersonsIdPersonDirectory = idPersonDirectory;
    this.enrolarEstudianteService.getPersons(idPersonDirectory)
      .pipe(finalize(() => (this.loadingPersonsIdPersonDirectory = null)))
      .subscribe({
        next: data => {
          this.personsDirectorySeleccionado = data;
          this.personsDirectoryUserDataJson = this.formatearUserData(data.userData);
          this.personsDialogVisible = true;
          this.cdr.detectChanges();
        },
        error: () => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'No fue posible consultar la persona en Face Api de Azure.'
          });
        }
      });
  }

   //utilizado desde la vista para guiar al usuario a aceptar de manera explicita la eliminación del estudiante de la ApiFace de Azure
  confirmarEliminarEstudiante(): void {
    if (!this.matricula.idPersonDirectory) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'El estudiante no cuenta con IdPersonDirectory en Api Face de Azure para eliminar.'
      });
      return;
    }

    this.confirmationService.confirm({
      message: `¿Está seguro de eliminar el estudiante con Person ID ${this.matricula.idPersonDirectory} de la Api Face de Azure?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      accept: () => this.eliminarEstudiante()
    });
  }

  //Metodo para eliminar estudiantes de la Apiface de Azure
  private eliminarEstudiante(): void {
    const payload: DeletePersonDto = {
      personId: this.matricula.idPersonDirectory,
      responseString: ''
    };

    this.isDeletingPerson = true;
    this.enrolarEstudianteService.deletePerson(payload).subscribe({
      next: response => {
        const perID = this.matricula.perID;
        this.matricula = {
          ...this.matricula,
          idPersonDirectory: '',
          fechaCreacion: ''
        };
        this.estudianteService.actualizarEstudianteEnMemoria(perID, {
          idPersonDirectory: '',
          fechaCreacion: ''
        });
        this.facesEstudiante = [];
        this.selectedFace = null;
        this.addFaceEstudiante = {} as addFaceEstudianteDTO;
        this.isDeletingPerson = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: JSON.stringify(response, null, 2)
        });
      },
      error: err => {
        this.isDeletingPerson = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: `No fue posible eliminar el estudiante del Person Directory. ${err.mensaje || ''}`
        });
      }
    });
  }

  private formatearUserData(userData: string | null | undefined): string {
    if (!userData) {
      return 'Sin userData';
    }

    try {
      return JSON.stringify(JSON.parse(userData), null, 2);
    } catch {
      return userData;
    }
  }
 

  guardarFaceEstudiante(): void {
    this.isSaving = true; 
    this.addFaceEstudiante.idPersonDirectory = this.matricula.idPersonDirectory;

    if (!this.addFaceEstudiante.idPersonDirectory) {
    this.messageService.add({
      severity:'warn', 
      summary: 'Advertencia', 
      detail: 'Confirme que el estudiante cuente con Id Person Directory que permita asociar imagen en la base de datos de reconocimiento facial.'});
    this.isSaving = false;
    this.imageCaptured = false;
    this.isCapturingAutomatically = false;
    this.faceDetectedInRealTime = false;
    return;
   }
   if (!this.capturedImage) {
    this.messageService.add({
      severity: 'warn',
      summary: 'Advertencia',
      detail: 'No se encontró imagen para analizar. Asegúrese de capturar una imagen válida que permita asociar el rostro con el estudiante seleccionado.'
    });
    this.isSaving = false; // Restablecer estado
    this.imageCaptured = false;
    this.isCapturingAutomatically = false;
    this.faceDetectedInRealTime = false;
    return;
   }

    this.isSaving = true
    this.loading = true;
    this.enrolarEstudianteService
    .guardarFaceEstudiante(this.capturedImage, this.addFaceEstudiante)
     .subscribe({
      next: async (response: FacesEstudianteDTO[]) => {
        this.facesEstudiante = response;
        this.messageService.add({
          severity:'success', 
          summary: 'Éxito', 
          detail:  `Rostro del estudiante almacenado correctamente en la base de reconocimiento facial`});
        try {
          if (this.embeddingActual && this.matricula.perID) {
            await this.vectoresRepository.saveVector(this.matricula.perID, this.embeddingActual);
          }
        } catch (error) {
          this.messageService.add({
            severity:'warn',
            summary: 'Advertencia',
            detail: 'El rostro fue guardado remotamente, pero no se pudo registrar el vector en la base local.'
          });
        } finally {
          this.loading = false;
          this.capturedImage = null;
          this.isSaving = false; // Restablecer estado
          this.imageCaptured = false;
          this.isCapturingAutomatically = false;
          this.faceDetectedInRealTime = false;
          this.embeddingActual = null;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
       this.messageService.add({
        severity:'error', 
        summary: 'Error', 
        detail: `Error al almacenar el rostro. ${err.mensaje || 'No se pudo identificar la causa del error, por favor comuníquese con soporte.'}`});
       this.loading = false;
       this.isSaving = false; // Restablecer estado
       this.imageCaptured = false;
       this.isCapturingAutomatically = false;
       this.faceDetectedInRealTime = false;
       this.embeddingActual = null;
      }
      
    });
  }


  //Este metodo esta enfocado a consultar la faces del estudiante en Api Face Azure...
  verFacesPerson(): void {
    if (!this.matricula.idPersonDirectory) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'El estudiante no cuenta con IdPersonDirectory para consultar rostros en Face Api Azure.'
      });
      return;
    }

    if (!this.facesEstudiante.length) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'El estudiante no cuenta con rostros registrados para consultar en Face Api Azure.'
      });
      return;
    }

    const idPersonDirectory = this.matricula.idPersonDirectory;
    this.loadingFacesPersonIdPersonDirectory = idPersonDirectory;
    this.enrolarEstudianteService.getFacesPerson(this.matricula.idPersonDirectory)
      .pipe(finalize(() => (this.loadingFacesPersonIdPersonDirectory = null)))
      .subscribe({
        next: data => {
          this.facesPersonSeleccionado = data;
          this.facesPersonJson = JSON.stringify(data, null, 2);
          this.facesPersonDialogVisible = true;
          this.cdr.detectChanges();
        },
        error: err => {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: `No fue posible consultar los rostros en Face Api Azure. ${err.mensaje || ''}`
          });
        }
      });
  }

getFacesEstudiante(): void {
this.enrolarEstudianteService
  .getFacesEstudiante(this.matricula.idPersonDirectory)
    .subscribe({
      next: (response: FacesEstudianteDTO[]) => {
        this.facesEstudiante = response;
         const totalRostrosActivos = this.getTotalRostrosActivos();
         this.cdr.detectChanges();
        this.messageService.add({
          severity:'success', 
          summary: 'Éxito', 
          detail: `El estudiante  ${totalRostrosActivos === 0 ? 'no cuenta con rostros activos ' : 'cuenta con ' + totalRostrosActivos + ' rostros activos'} asociados.`,
         });
      },
      error: (err) => {
          this.messageService.add({
            severity:'error', 
            summary: 'Error', 
            detail: `Se presento un error en la obtención de rostros. 
                    ${err.mensaje || 'No se pudo identificar la causa del error, por favor comuníquese con soporte.'}`});
      }
      
    });

}
  getTotalRostrosActivos(): number {
    return this.facesEstudiante.filter((face) => this.isFaceActive(face)).length;
  }

   isFaceActive(face: FacesEstudianteDTO | null | undefined): boolean {
    const estado = face?.isState as unknown;
    if (typeof estado === 'string') {
      return ['true', '1', 'activo'].includes(estado.trim().toLowerCase());
    }
    return estado === true || estado === 1;
  }


getSafeImageUrl(url: string): SafeUrl {
  if (!this.safeImageUrls[url]) {
    this.safeImageUrls[url] = this.sanitizer.bypassSecurityTrustUrl(url); 
  }
  return this.safeImageUrls[url]; 
}

getImagen(idPath: string, blobName: string) {

  const cached = this.sasCache[idPath];
  const ahora = new Date();

  if (!cached || new Date(cached.expiresOn) <= ahora) {
    this.enrolarEstudianteService.getFileToBlob(idPath).subscribe({
      next: (response: SasResponse) => {
        // Guardar SAS en cache
        this.sasCache[idPath] = response;
        this.mostrarImagenConSas(response, blobName);
      },
      error: (err) => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: `Se presento un error al obtener token SAS. ${err.mensaje || 'No se pudo identificar la causa del error, por favor comuníquese con soporte.'}`,
        });
      }
    });
  } else {
    // Usar SAS cacheado
    this.mostrarImagenConSas(cached, blobName);
  }


}
private mostrarImagenConSas(sasResponse: SasResponse, blobName: string) {
  const [basePath, sasQuery] = sasResponse.sasUrl.split("?");
  const separator = basePath.endsWith("/") ? "" : "/";
  const imageUrl = `${basePath}${separator}${blobName}?${sasQuery}`;
  this.getSafeImageUrl(imageUrl);
  this.imagenSeleccionada = imageUrl;
  this.mostrarDialogoImagen = true;

  this.messageService.add({
    severity: 'success',
    summary: 'Éxito',
    detail: 'Imagen cargada correctamente.'
  });
}

onRowSelect(event: any): void {
console.log('Fila seleccionada:');
} 


  confirmarEliminarFace(selectedFace: FacesEstudianteDTO): void {
    if (!selectedFace?.idPersonDirectory || !selectedFace?.persistedFaceId) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'No se encontro informacion suficiente para eliminar el rostro.'
      });
      return;
    }

    if (!selectedFace.isState) {
      this.messageService.add({
        severity: 'info',
        summary: 'Informacion',
        detail: 'El rostro seleccionado ya se encuentra eliminado.'
      });
      return;
    }

    this.confirmationService.confirm({
      message: `Esta seguro de que quiere eliminar el rostro con ID ${selectedFace.persistedFaceId}?`,
      header: 'Confirmar eliminacion',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Si, eliminar',
      rejectLabel: 'Cancelar',
      accept: () => this.deleteFacePerson(selectedFace)
    });
  }

  private deleteFacePerson(selectedFace: FacesEstudianteDTO): void {
    const payload: DeleteFacePersonDto = {
      personId: selectedFace.idPersonDirectory,
      persistedFaceId: selectedFace.persistedFaceId
    };

    this.deletingFacePersistedId = selectedFace.persistedFaceId;
    this.enrolarEstudianteService.deleteFacePerson(payload).subscribe({
      next: response => {
        this.facesEstudiante = this.facesEstudiante.map(face =>
          face.persistedFaceId === selectedFace.persistedFaceId
            ? { ...face, isState: false }
            : face
        );
        this.selectedFace = null;
        this.deletingFacePersistedId = null;
        this.messageService.add({
          severity: 'success',
          summary: 'Exito',
          detail: response || 'Rostro eliminado correctamente.',
          life: 3000
        });
      },
      error: err => {
        this.deletingFacePersistedId = null;
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: `No fue posible eliminar el rostro. ${err.mensaje || 'No se pudo identificar la causa del error, por favor comuniquese con soporte.'}`
        });
      }
    });
  }

  getEstadoClass(estado: boolean | null | undefined): string {
    return estado === true ? 'estado-activo' : 'estado-inactivo';
  }


}
