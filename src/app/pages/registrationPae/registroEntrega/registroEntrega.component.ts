import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { RegistroEntregaPAERepository } from '../../../core/repositories/RegistroEntregaPAE.repository';
import { ColegiosRepository } from '../../../core/repositories/colegios.repository';
import { SedesEducativasRepository } from '../../../core/repositories/sedesEducativas.repository';
import { SitiosEntregaRepository } from '../../../core/repositories/sitiosEntrega.repository';
import { RegistroEntregaPaeSyncService } from '../../../core/services/registroEntregaPaeSync.service';
import { ColegioOption, SedeOption, SitioEntregaOption, RecordsDelivery, RecordsDeliveryDB} from '../../../core/models/registroEntregaPAE.model';

import { ButtonModule } from 'primeng/button';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ProgressBarModule } from 'primeng/progressbar';
import { MenuItem } from 'primeng/api';
import { DatePickerModule } from 'primeng/datepicker'
import { InputTextModule } from 'primeng/inputtext';
import { InputOtpModule } from 'primeng/inputotp';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

import { IonButton,  IonButtons, IonContent, IonHeader,  IonModal,   IonTitle,  IonToolbar,
         IonInfiniteScroll, IonInfiniteScrollContent,  InfiniteScrollCustomEvent,  IonCard,  IonCardContent,IonChip,
         IonSelect, IonSelectOption,
         } from '@ionic/angular/standalone';

@Component({
  selector: 'app-registro-entrega',
  standalone: true,
  imports: [IonButton, IonButtons, IonContent, IonHeader, IonModal,   IonTitle, IonToolbar, 
              IonInfiniteScroll, IonInfiniteScrollContent, IonCard, 
              IonCardContent, IonChip,  CommonModule, FormsModule, ConfirmDialogModule, ToastModule, 
              IonSelect, IonSelectOption,
               ButtonModule, BreadcrumbModule, DatePickerModule, IconFieldModule, InputIconModule, InputTextModule, 
               InputOtpModule, ProgressBarModule, RouterModule],
   providers: [ConfirmationService, MessageService],
  templateUrl: './registroEntrega.component.html',
  styleUrls: ['./registroEntrega.component.css']
})
export class RegistroEntregaComponent implements OnInit {
  items: MenuItem[] | undefined;
  home: MenuItem | undefined;

  @ViewChild(IonInfiniteScroll) infiniteScroll!: IonInfiniteScroll;
  
  colegios: ColegioOption[] = [];
  sedes: SedeOption[] = [];
  sitiosEntrega: SitioEntregaOption[] = [];
 
  selectedColegio: ColegioOption | null = null;
  selectedSede: SedeOption | null = null;
  selectedSitioEntrega: SitioEntregaOption | null = null;

  registrosDB: RecordsDeliveryDB[] = [];
  
  rowsPerPage = 10;
  lastId: string | null = null;
  isLoading = false;
  registros: RecordsDelivery[] = [];


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
  
   customModalOptionsC = {
      cssClass: 'custom-select-modal',
      header: 'Seleccione Colegio ....'
    };

  customModalOptionsS = {
      cssClass: 'custom-select-modal',
      header: 'Seleccione Sede ....'
    };

  customModalOptionsE = {
      cssClass: 'custom-select-modal',
      header: 'Seleccione Sitio de Entrega ....'
    };

  constructor(
    private repository: RegistroEntregaPAERepository,
    private colegiosRepository: ColegiosRepository,
    private sedesRepository: SedesEducativasRepository,
    private sitiosEntregaRepository: SitiosEntregaRepository,
    private registroEntregaPaeSync: RegistroEntregaPaeSyncService,
    private messageService: MessageService,) {}

  trackByRegistro(index: number, item: any) {
    return item.idRegistroEntrega;
   }

  async ngOnInit() {

    this.items= [{ label: 'PAE' },{ label: 'Registro Entrega' }];
    this.home = { icon: 'pi pi-home', routerLink: '/main' };

    this.colegios = await this.colegiosRepository.getColegiosOptions();
    await this.loadRegistros(true);
   
  }

  async onColegioChange() {
    // Filtrar sedes según colegio seleccionado desde SQLite
    if (this.selectedColegio) {
      this.sedes = await this.sedesRepository.getSedesOptionsByColegio(this.selectedColegio.value);
    } else {
      this.sedes = [];
    }
    this.selectedSede = null;
    this.sitiosEntrega = [];
    this.selectedSitioEntrega = null;
  }

  async onSedeChange() {
    // Filtrar sitios de entrega según sede seleccionada desde SQLite
    if (this.selectedSede) {
      this.sitiosEntrega = await this.sitiosEntregaRepository.getSitiosEntregaOptionsBySede(this.selectedSede.value);
    } else {
      this.sitiosEntrega = [];
    }
    this.selectedSitioEntrega = null;
  }

  async guardarRegistro() {
    if (this.selectedColegio && this.selectedSede && this.selectedSitioEntrega) {
  
        this.registrosDB.push({
            daneColegio: this.selectedColegio.value,
            daneSede: this.selectedSede.value,
            idSitioEntrega: this.selectedSitioEntrega.value,
            syncedDB: 0
        });

        const id = await this.repository.addRecordsDeliveryPAE(this.registrosDB[0]);
        const registroCompleto = id ? await this.repository.getRecordsDeliveryPAEById(id) : null;
        
        if (registroCompleto) {
        this.registros.unshift(registroCompleto);
        }

        this.registrosDB = [];
        this.selectedColegio = null;
        this.selectedSede = null;
        this.selectedSitioEntrega = null;
        this.showFormModal = false;
    }
   
  }

  // Obtener registros de entrega desde la base de datos local
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
 
  const nuevos = await this.repository.getRecordsDeliveryPAEPage(
    filter,
    startDate,
    endDate,
    this.rowsPerPage,
    this.lastId
   );

   if (nuevos.length > 0) {
    this.lastId = nuevos[nuevos.length - 1].idRegistroEntrega;
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
      detail: 'Sincronizando registros de entrega y fotos pendientes...'
    });

    const summary = await this.registroEntregaPaeSync.syncAll({
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
    console.error('Error general durante la sincronizacion PAE:');
    this.messageService.add({
      severity: 'error',
      summary: 'Error de Sincronizacion',
      detail: 'Ocurrio un error inesperado al preparar la sincronizacion.'
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



