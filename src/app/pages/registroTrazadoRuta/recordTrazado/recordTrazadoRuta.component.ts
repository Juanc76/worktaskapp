import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { RouterModule, Router } from '@angular/router';
import { Geolocation } from '@capacitor/geolocation';
import { FormsModule } from '@angular/forms';

import { TrackingService } from '../../../core/services/tracking.Service';
import { SyncTrackingService } from '../../../core/services/synctracking.Service';

import { RutasRepository } from '../../../core/repositories/rutas.repository';
import { RegistroTrazadoRutaPMERepository } from '../../../core/repositories/registroTrazadoRutaPME.repository';
import { RegistroTrazadoRutaPMEBD, RutaEscolar, TrackingState } from '../../../core/models/tracking.model';

import { ButtonModule } from 'primeng/button';
import { DatePickerModule } from 'primeng/datepicker'
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { IonSelect, IonModal, IonSelectOption, IonHeader, IonToolbar, IonTitle, IonButton, IonButtons } from '@ionic/angular/standalone';

import esriConfig from "@arcgis/core/config";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Graphic from "@arcgis/core/Graphic";
import Polyline from "@arcgis/core/geometry/Polyline";
import Point from '@arcgis/core/geometry/Point';
import Locate from "@arcgis/core/widgets/Locate";
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-registroTrazadoRuta',
  imports: [IonButtons, ToastModule, IonSelect, IonModal, IonSelectOption, IonHeader, IonToolbar, IonTitle,IonButton,
            FormsModule, ProgressSpinnerModule, SelectModule, TableModule, ButtonModule, BreadcrumbModule,
            DatePickerModule, RouterModule],
  templateUrl: './recordTrazadoRuta.component.html',
  styleUrls: ['./recordTrazadoRuta.component.css'],
  providers: [ MessageService],
})


export class RecordTrazadoRutaComponent implements OnInit, OnDestroy {
  @ViewChild('mapCanvas', { static: false }) private mapViewEl!: ElementRef;

  compact = false;
  startY = 0;
  currentY = 0;

  rutas: RutaEscolar[] = []; // Ajuste del tipo de datos para el menú desplegable
  selectedRuta: RutaEscolar| null =  null;
  selectedRecorrido: any = null;

  idTrazado: string | null = null;
  trackingState: TrackingState | null = null;
 
  isMinimized: boolean = false; 
  isPaused: boolean = false; 
  isVisible: boolean = true; 
  isSyncing: boolean = false;
  
  isSheetCollapsed: boolean = false;

  private view!: MapView;
  private marcadorBus: Graphic | null = null;

  @ViewChild(IonModal) modal!: IonModal;

   customActionSheetOptions = {
      cssClass: 'custom-alert-class',
      cancelText: 'Cancelar',
      okText: 'Aceptar'
    };

  private componentStateSubscription: Subscription | undefined; 
  private sub?: Subscription;
  private locationSub?: Subscription;

  constructor(
    private rutasRepository: RutasRepository,
    private registroTrazadoRutaPMERepository: RegistroTrazadoRutaPMERepository,
    private messageService: MessageService,
    private trackingService: TrackingService, 
    private syncTrackingService: SyncTrackingService,
    private route: Router
    
  ) {this.getArcgisApiKey()}

  private getArcgisApiKey(): string {
    return esriConfig.apiKey = environment.arcgisApiKey.trim();
  }
  
  minimize() {
   this.route.navigate(['/main']);
  }

  toggleSheet() {
    this.isSheetCollapsed = !this.isSheetCollapsed;
  }

  async ngOnInit() {

    this.rutas = await this.rutasRepository.getRutasEscolares();
       this.sub = this.trackingService.isTracking$()
      .subscribe(state => {this.trackingState = state});
       await this.trackingService.reactivateTrackingifNeeded();
       this.iniciarMapa();     
  }

async iniciarMapa() {
  try {
    
    const position = await Geolocation.getCurrentPosition();
        const puntoGps = new Point({
        longitude: position.coords.longitude,
        latitude: position.coords.latitude
      });
 
   if (position) {
      await  this.dibujarMapa(puntoGps) ;
      console.log("Ubicación inicial detectada:", position);
      await  this.dibujarPosicion(puntoGps);
    } else {
      console.log("Aún no hay ubicación GPS, esperando...");
    }

 this.locationSub =  this.trackingService.lastLocation$.subscribe(loc => {
  if (loc) {
    const puntoGps = new Point({
        longitude: loc.longitude,
        latitude: loc.latitude
      });
    this.dibujarPosicion(puntoGps);
  }
  });

  } catch (error) {
    console.error("Error en la secuencia de inicio del mapa", error);
  }
}

  private async dibujarMapa(puntoGps: Point) {
  try {

    const map = new Map({
      basemap: 'osm'
    });


     this.view = new MapView({
      container: this.mapViewEl.nativeElement,
      map: map,
      zoom: 14,
      center: [ puntoGps.longitude!, puntoGps.latitude!]
    });


      const locateBtn = new Locate({
      view: this.view
      });

      this.view.ui.add(locateBtn, {
      position: "top-left"
    });

    
    await this.view.when();
    
  } catch (error) {
    console.error("Error al renderizar el mapa en el modal:", error);
  }
}

private async dibujarPosicion(puntoGps: Point) {

if (!this.marcadorBus) {
 this.marcadorBus = new Graphic({
    geometry: puntoGps,
    symbol: {
      type: "simple-marker",
      style: "circle",
      color: [0, 110, 255, 0.9], 
      size: "14px",
      outline: {
        color: [255, 255, 255, 1], 
        width: 2
      }
    } as any
  });
  
  } else {
    this.marcadorBus.geometry = puntoGps;
  }

 this.marcadorBus && this.view.graphics.add(this.marcadorBus);
 
 
    this.view.goTo({
    target: puntoGps,
    zoom: 16}, 
    { 
      animate: true, 
      duration: 500, 
      easing: "linear"
    });
}

  async startTrazado() {
    if (this.selectedRuta && this.selectedRecorrido) {
            if (!this.selectedRuta.label) {
              this.messageService.add({
                severity: 'error',
                summary: 'Error',
                detail: 'Adegurese de seleccionar una ruta válida.',
              });
              return;
            }

      try {

        const trazado: RegistroTrazadoRutaPMEBD = {
          idRuta: this.selectedRuta.key, // Ajuste para usar idRuta del objeto seleccionado
          rutaEscolar: this.selectedRuta.label,
          recorrido: this.selectedRecorrido,
          FechaStart: '',
          FechaEnd: '',
          distanciaAcumulada: 0,
          tiempoAcumulado: 0,
          velocidadMedia: 0
        };

        this.idTrazado = await this.registroTrazadoRutaPMERepository.addRegistroTrazadoRutaPME(trazado);
        console.log('Trazado iniciado con ID:', this.idTrazado);

        // Iniciar el tracking con el servicio
        if (this.idTrazado !== null) {
          trazado.idTrazado = this.idTrazado;
          const syncResult = await this.registroTrazadoRutaPMERepository.syncRegistroTrazadoRutaPMEById(this.idTrazado);

          if (syncResult.confirmed === 0) {
            console.warn('No se confirmo la sincronizacion inicial del trazado antes de iniciar tracking.', syncResult);
            this.messageService.add({
              severity: 'warn',
              summary: 'Advertencia',
              detail: 'El trazado inicio localmente, pero aun no fue confirmado por el servidor.',
            });
          }

          await this.trackingService.startTracking(trazado);
        } else {
          console.error('No se puede iniciar el tracking de la Ruta sin un idTrazado válido');
        }
      } catch (error) {
        console.error('Error al iniciar el trazado:', error);
      }
    } else {
      this.messageService.add({
        severity: 'warn',
        summary: 'Advertencia',
        detail: 'Debe seleccionar una ruta y trayecto para iniciar a grabar la ruta',
      });
    }
  }

  async stopTrazado() {
    if (!this.trackingState?.active) return;

    try {
      const idTrazado = this.trackingState.trazado?.idTrazado ?? this.idTrazado;
      await this.trackingService.stopTracking();

      if (idTrazado) {
        await this.syncAll(idTrazado);
      }

      this.idTrazado = null;
    } catch (error) {
      console.error('Error al finalizar el trazado:', error);
    } finally {
      this.idTrazado = null;
    }
  }

  async syncAll(idTrazado: string) {
    if (this.isSyncing) return;

    this.isSyncing = true;

    try {
      this.messageService.add({
        severity: 'info',
        summary: 'Iniciando Sincronizacion',
        detail: 'Sincronizando puntos y cierre del trazado...'
      });

      const summary = await this.syncTrackingService.syncAll(idTrazado);
      const locationSummary = summary.locations;
      const trazadoSummary = summary.trazado;

      const totalSincronizados = locationSummary.confirmed + trazadoSummary.confirmed;
      const totalFallidos = locationSummary.rejected + trazadoSummary.rejected;

      if (locationSummary.total === 0 && trazadoSummary.total === 0) {
        this.messageService.add({
          severity: 'info',
          summary: 'Sincronizacion',
          detail: 'No hay registros pendientes para sincronizar.'
        });
      } else if (totalFallidos > 0 || trazadoSummary.confirmed === 0) {
        console.warn('La sincronizacion del cierre del trazado quedo con pendientes.', {
          locations: locationSummary,
          trazado: trazadoSummary
        });

        this.messageService.add({
          severity: 'warn',
          summary: 'Sincronizacion completada con pendientes',
          detail: `${totalSincronizados} sincronizado(s), ${totalFallidos} fallaron o quedaron pendientes.`,
          life: 5000
        });
      } else {
        this.messageService.add({
          severity: 'success',
          summary: 'Sincronizacion Exitosa',
          detail: `${totalSincronizados} registro(s) sincronizados.`,
          life: 3000
        });
      }
    } catch (err) {
      console.error('Error general durante la sincronizacion del trazado PME:', err);
      this.messageService.add({
        severity: 'error',
        summary: 'Error de Sincronizacion',
        detail: 'Ocurrio un error inesperado al preparar la sincronizacion.'
      });
    } finally {
      this.isSyncing = false;
    }
  }

  async pauseTrazado() {
    if (!this.trackingState?.active) return;

    try {
      if (!this.trackingState?.paused) {
        await this.trackingService.pauseTracking();
        this.isPaused = true;
        console.log('Trazado pausado con ID:', !this.trackingState?.trazado?.idTrazado);
      } else {
   
        await this.trackingService.reactivateTracking();
         this.isPaused = false;
        console.log('Trazado reanudado con ID:', !this.trackingState?.trazado?.idTrazado);
      }
  } catch (error) {
      console.error('Error al pausar/reanudar el trazado:', error);
    }
  }

  ngOnDestroy() {
     if (this.componentStateSubscription) {
      this.componentStateSubscription.unsubscribe();
    }
     this.sub?.unsubscribe();
     this.locationSub?.unsubscribe();
     if (this.view) {
    this.view.destroy(); // Destruye la instancia de ArcGIS
  }
  }

 formatoDuration(seconds: number): string {
  if (seconds == null || isNaN(seconds)) {  
    return '00:00:00';
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const hoursString = hours.toString().padStart(2, '0');
  const minutesString = minutes.toString().padStart(2, '0');
  const secondsString = secs.toString().padStart(2, '0');

  return `${hoursString}:${minutesString}:${secondsString}`;
  }

  formatDistance(distanciaMetros: number): string {
    return `${(distanciaMetros / 1000).toFixed(2)} `;
  }

  startDrag(ev: TouchEvent) {
  this.startY = ev.touches[0].clientY;
}

onDrag(ev: TouchEvent) {
  this.currentY = ev.touches[0].clientY;
}

endDrag() {
  const delta = this.currentY - this.startY;

  if (delta < -40) {
    // drag hacia arriba
    this.compact = true;
  }

  if (delta > 40) {
    // drag hacia abajo
    this.compact = false;
  }
}
 
}
