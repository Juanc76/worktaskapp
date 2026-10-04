import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';


import { DetalleRutaComponent } from '../detalleRuta/detalleRuta.component';
import { DetalleBeneficiariosComponent } from '../detalleBeneficiarios/detalleBeneficiarios.component';

import { RegistroServicioPMERepository } from '../../../core/repositories/RegistroServicioPME.repository';
import { RegistroServicioPmeSyncService } from '../../../core/services/registroServicioPmeSync.service';
import { RutasRepository } from '../../../core/repositories/rutas.repository';
import { RecordsServiceDB, RecordsService, RutaEscolar} from '../../../core/models/registroServicioPME.model';

import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { MenuItem } from 'primeng/api';
import { DatePickerModule } from 'primeng/datepicker'
import { InputTextModule } from 'primeng/inputtext';
import { InputOtpModule } from 'primeng/inputotp';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

import { IonButton,  IonButtons, IonContent, IonHeader,  IonModal, IonSelect,  IonSelectOption,  IonTitle,  IonToolbar,
         IonInfiniteScroll, IonInfiniteScrollContent,  InfiniteScrollCustomEvent,  IonCard,  IonCardContent,IonChip
         } from '@ionic/angular/standalone';

@Component({
  selector: 'app-registro-servicio',
  standalone: true,
    imports: [IonButton, IonButtons, IonContent, IonHeader, IonModal, IonSelect, IonSelectOption, IonTitle, IonToolbar, 
              IonInfiniteScroll, IonInfiniteScrollContent, IonCard, 
              IonCardContent, IonChip,  CommonModule, FormsModule, ConfirmDialogModule, ToastModule, 
               ButtonModule, BreadcrumbModule, DatePickerModule, IconFieldModule, InputIconModule, InputTextModule, 
               InputOtpModule, ProgressBarModule, RouterModule, DetalleRutaComponent, DetalleBeneficiariosComponent],
   providers: [ConfirmationService, MessageService],
  templateUrl: './registroServicio.component.html',
  styleUrls: ['./registroServicio.component.css'],

})
export class RegistroServicioComponent implements OnInit {
  items: MenuItem[] | undefined;
  home: MenuItem | undefined;
  
  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;

  rutas: RutaEscolar[] = []

  selectedRuta: any = null;
  selectedRecorrido: any = null;

  customModalOptionsC = {  cssClass: 'custom-select-modal', header: 'Seleccione Ruta' };
  customModalOptionsS = {  cssClass: 'custom-select-modal', header: 'Seleccione Recorrido' };

  registrosDB: RecordsServiceDB[] = [];
  
  rowsPerPage = 10;
  lastId: string | null = null;
  isLoading = false;
  registros: RecordsService[] = [];

  filterStartDate: string | undefined = undefined;
  filterEndDate: string | undefined = undefined;
  globalFilterValue: string = '';
  searchTimeout: any;

  showFormModal: boolean = false;
  showFilters: boolean = false;
  isSyncing: boolean = false;
  totalToSync = 0;
  syncedCount = 0;
  useIndeterminate: boolean = false;

  showDetalleRutaModal: boolean = false;
  selectedRutaDetalle: RutaEscolar | null = null;

  showDetalleBeneficiariosModal: boolean = false;
  selectedRutaBeneficiarios: RutaEscolar | null = null;

  constructor( 
              private repository: RegistroServicioPMERepository,
              private rutasRepository: RutasRepository,
              private registroServicioPmeSync: RegistroServicioPmeSyncService,
              private messageService: MessageService) {}

  trackByRegistro(index: number, item: any) {
    return item.idRegistroServicio;
   }

  async ngOnInit() {

    this.items= [{ label: 'PME' },{ label: 'Registro Servicio' }];
    this.home = { icon: 'pi pi-home', routerLink: '/main' };
    // Cargar rutas desde SQLite
    this.rutas = await this.rutasRepository.getRutasEscolares();
    await this.loadRegistros(true);
   
  }


  async guardarRegistro() {
    if (this.selectedRuta && this.selectedRecorrido) {
       this.registrosDB.push({
            idRuta: this.selectedRuta.key,
            rutaEscolar: this.selectedRuta.label,
            recorrido: this.selectedRecorrido,
            syncedDB: 0
        });

        const id = await this.repository.addRecordsServicioPME(this.registrosDB[0]);
        const registroCompleto = id ? await this.repository.getRecordsServicioPMEById(id) : null;

        if (registroCompleto) {
        this.registros.unshift(registroCompleto);
        }
        this.registrosDB = [];
        this.selectedRuta = null;
        this.selectedRecorrido = null;
        this.showFormModal = false;
        
    }
}

openDetalleRutaModal() {
  this.selectedRutaDetalle = this.selectedRuta ?? null;
  this.showDetalleRutaModal = true;
}

closeDetalleRutaModal() {
  this.showDetalleRutaModal = false;
}

openDetalleBeneficiariosModal() {
  this.selectedRutaBeneficiarios = this.selectedRuta ?? null;
  this.showDetalleBeneficiariosModal = true;
}

closeDetalleBeneficiariosModal() {
  this.showDetalleBeneficiariosModal = false;
}

 
 // Obtener registros de servicios prestados desde la base de datos local
  async loadRegistros(reset: boolean = false, event?: InfiniteScrollCustomEvent) {
  if (this.isLoading) return;  
  if (reset) {
    this.lastId = null;
    this.registros = [];

    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = false;
    }
  }
  this.isLoading = true;
  const filter = this.globalFilterValue?.trim() || undefined;
  const startDate = this.filterStartDate ? new Date(this.filterStartDate).toISOString().split('T')[0] : undefined;
  const endDate = this.filterEndDate ? new Date(this.filterEndDate).toISOString().split('T')[0] : undefined;
 
  const nuevos = await this.repository.getRecordsServicioPMEPage(
    filter,
    startDate,
    endDate,
    this.rowsPerPage,
    this.lastId
   );

   if (nuevos.length > 0) {
    this.lastId = nuevos[nuevos.length - 1].idRegistroServicio;
  }

   this.registros.push(...nuevos);

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
 

 async filterRegistros() {
   await this.loadRegistros(true);
}

onSearchChange() {

  clearTimeout(this.searchTimeout);

  this.searchTimeout = setTimeout(async () => {
    await this.loadRegistros(true);
  }, 400);

}

async resetFiltros() {
  this.globalFilterValue = '';
  this.filterStartDate = undefined;
  this.filterEndDate = undefined;
  
  await this.loadRegistros(true);
}

async syncAll() {
  if (this.isSyncing) return;

  this.isSyncing = true;
  this.syncedCount = 0;
  this.totalToSync = 0;
  this.useIndeterminate = true;

  try {
    this.messageService.add({
      severity: 'info',
      summary: 'Iniciando Sincronizacion',
      detail: 'Sincronizando servicios y fotos PME pendientes...'
    });

    const summary = await this.registroServicioPmeSync.syncAll({
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
    } catch (error) {
    console.error('Error general durante la sincronizacion PME:', error);
    this.messageService.add({
      severity: 'error',
      summary: 'Error de sincronizacion',
      detail: 'Ocurrio un error inesperado al sincronizar PME.'
    });
  } finally {
    this.isSyncing = false;
    await this.loadRegistros(true);
  }
}

 async loadMore(event: InfiniteScrollCustomEvent) {

   if (this.isLoading) {
    event.target.complete();
    return;
  }
  
  await this.loadRegistros(false, event);
  }

 }
