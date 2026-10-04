import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { RegistroTrazadoRutaPMERepository } from '../../../core/repositories/registroTrazadoRutaPME.repository';
import { RegistroLocationRutaPMERepository } from '../../../core/repositories/registroLocationRutaPME.repository';
import { SyncTrackingService } from '../../../core/services/synctracking.Service';
import { RegistroTrazadoRutaPME, RutaEscolar} from '../../../core/models/tracking.model';

import { InputTextModule } from 'primeng/inputtext';
import { InputOtpModule } from 'primeng/inputotp';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { DatePickerModule } from 'primeng/datepicker'
import { ButtonModule } from 'primeng/button';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { MenuItem } from 'primeng/api';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

import esriConfig from "@arcgis/core/config";

import { IonContent, IonImg,IonList, IonCard,  
  IonCardContent, IonInfiniteScroll, IonInfiniteScrollContent, InfiniteScrollCustomEvent, IonIcon,
   IonChip, IonLabel, IonHeader, IonToolbar } from '@ionic/angular/standalone';


@Component({
  selector: 'app-registro-servicio',
  standalone: true,
  imports: [ IonImg, IonHeader, IonToolbar, IonLabel, IonChip, IonIcon, CommonModule, FormsModule, 
    ButtonModule, BreadcrumbModule, InputTextModule, InputOtpModule, RouterModule, IconFieldModule, 
    InputIconModule, IonContent, IonList, IonCard,   IonCardContent, IonInfiniteScroll, IonInfiniteScrollContent,ToastModule, ConfirmDialogModule,DatePickerModule],
  templateUrl: './registroTrazado.component.html',
  styleUrls: ['./registroTrazado.component.css'],
  providers: [MessageService,ConfirmationService]
})
export class RegistroTrazadoComponent implements OnInit {
  items: MenuItem[] | undefined;
  home: MenuItem | undefined;

  selectedRuta: RutaEscolar | null = null;
  selectedTrayecto: any = null;
  globalFilterValue: string = '';
  
  trazados: RegistroTrazadoRutaPME[] = [];
  showFilters: boolean = false;

  filterStartDate: string | null = null;
  filterEndDate: string | null = null;
  filterProyecto: string | null = null;
  filteredTrazados: RegistroTrazadoRutaPME[] = [];
  displayedTrazados: RegistroTrazadoRutaPME[] = [];
  
  filteredRows: boolean = false;
  mapUrls: { [key: string]: string } = {};
  mapLoadFailed: { [key: string]: boolean } = {};
  isSyncing: boolean = false;

  constructor( 
    private registroTrazadoRepo: RegistroTrazadoRutaPMERepository,
    private registroLocationRepo: RegistroLocationRutaPMERepository,
    private syncTrackingService: SyncTrackingService,
    private messageService: MessageService,
    private confirmationService: ConfirmationService) {
        esriConfig.apiKey = "AAPTaWs4VE9Wr1LTgM1TVnjYj3g..TulF1irswgedM3uEvrraAdEgaVgVjzOryM60PtRKtaGkSqtmwK7ypYC_IJe7QfZ55lQTE4KV9wTo_dIH3rJPkfLdvci7qHpaptwK7O7uyAvG3AZirWIN9zs8xfQOG5Fk3AqxCI6L22ZMS3kWQ7IBz7nhjCgozyFFLHVgNrzVmKlwiBNjzZgVsNA_ALdGJj9aQ0NlscMAprfAxvRrvd7E3VnmYB64dN6TAqoYFwpwMiZehqhoIfu8lBafbQ..AT1_k9ZBoU8k";
    }

  async ngOnInit() {
    this.items= [{ label: 'PME' },{ label: 'Registro Trazado' }];
    this.home = { icon: 'pi pi-home', routerLink: '/main' };
    
      await this.onCargarTrazados();
   
  }


  async onCargarTrazados(): Promise<void> {
    this.trazados = await this.registroTrazadoRepo.getRegistrosTrazadoRutas();
    this.filteredTrazados = this.trazados;
    this.displayedTrazados = this.filteredTrazados.slice(0, 5);
      await this.updateMapUrls();
  }

  async syncAll(): Promise<void> {
    if (this.isSyncing) return;

    this.isSyncing = true;

    try {
      this.messageService.add({
        severity: 'info',
        summary: 'Iniciando Sincronizacion',
        detail: 'Sincronizando puntos y cierres de trazados pendientes...'
      });

      const summary = await this.syncTrackingService.syncAll();
      const totalSincronizados = summary.locations.confirmed + summary.trazado.confirmed;
      const totalFallidos = summary.locations.rejected + summary.trazado.rejected;

      if (summary.locations.total === 0 && summary.trazado.total === 0) {
        this.messageService.add({
          severity: 'info',
          summary: 'Sincronizacion',
          detail: 'No hay registros pendientes para sincronizar.'
        });
      } else if (totalFallidos > 0) {
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
      await this.onCargarTrazados();
    }
  }


  async updateMapUrls(): Promise<void> {
    for (const registro of this.displayedTrazados) {
      const idTrazado = registro.idTrazado;
      if (idTrazado == null) continue;
      if (this.mapUrls[idTrazado] && !this.mapLoadFailed[idTrazado]) continue;

      const urlSinToken = (registro.mapUrl ?? '').trim();

      if (urlSinToken && !this.isLegacyArcGISStaticMapUrl(urlSinToken)) {
        this.mapUrls[idTrazado] = this.addArcGISToken(urlSinToken);
        this.mapLoadFailed[idTrazado] = false;
        continue;
      }

      try {
        const urlSinTokenGenerada = await this.buildArcGISStaticMapUrl(idTrazado);
        if (!urlSinTokenGenerada) continue;

        this.mapUrls[idTrazado] = this.addArcGISToken(urlSinTokenGenerada);
        this.mapLoadFailed[idTrazado] = false;

        await this.registroTrazadoRepo.saveMapUrl(idTrazado, urlSinTokenGenerada);
      } catch (error) {
        console.error('Error generando mapa estático para idTrazado:', idTrazado, error);
      }
    }
  }

  markMapAsFailed(idTrazado: string | undefined): void {
    if (idTrazado == null) return;
    this.mapLoadFailed[idTrazado] = true;
  }

  private addArcGISToken(url: string): string {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}token=${encodeURIComponent(esriConfig.apiKey ?? '')}`;
  }

  private isLegacyArcGISStaticMapUrl(url: string): boolean {
    return url.includes('/generate-map/');
  }

  // Aplicar filtros por texto y rango de fechas
  async aplicarFiltros() {
    const searchTerm = this.globalFilterValue.trim().toLowerCase();

    this.filteredTrazados = this.trazados.filter(registro => {
      const registroFecha = registro.FechaStart
        ? new Date(registro.FechaStart).toISOString().split('T')[0]
        : null;
      const startDate = this.filterStartDate
        ? new Date(this.filterStartDate).toISOString().split('T')[0]
        : null;
      const endDate = this.filterEndDate
        ? new Date(this.filterEndDate).toISOString().split('T')[0]
        : null;

      const fechaValida =
        (!startDate || (registroFecha && registroFecha >= startDate)) &&
        (!endDate || (registroFecha && registroFecha <= endDate));

      const textoValido =
        !searchTerm ||
        registro.recorrido?.toLowerCase().includes(searchTerm) ||
        registro.FechaStart?.toLowerCase().includes(searchTerm) ||
        registro.FechaEnd?.toLowerCase().includes(searchTerm) ||
        `${registro.idTrazado}`.includes(searchTerm) ||
        `${registro.distanciaAcumulada}`.includes(searchTerm) ||
        `${registro.tiempoAcumulado}`.includes(searchTerm) ||
        `${registro.velocidadMedia}`.includes(searchTerm) ||
        `${registro.syncedDB ?? ''}`.includes(searchTerm);

      const hasText = searchTerm.length > 0;
      const hasDates = Boolean(startDate || endDate);

      if (hasText && hasDates) {
        return textoValido || fechaValida;
      }

      if (hasText) {
        return textoValido;
      }

      if (hasDates) {
        return fechaValida;
      }

      return true;
    });

    this.filteredRows = this.filteredTrazados.length > 0;

    // Reiniciar los trazados mostrados para mantener consistencia con loadMore
    this.displayedTrazados = this.filteredTrazados.slice(0, 10);

    await this.updateMapUrls();
  }


async clear() {
  // Reinicia los datos de la tabla
  this.filteredTrazados = this.trazados; // Vuelve a cargar los datos originales
  this.filteredRows = false;
  this.filterStartDate = null;
  this.filterEndDate = null;
  this.globalFilterValue = '';

  this.displayedTrazados = this.filteredTrazados.slice(0, 10);
  await this.updateMapUrls();

}

formatDistance(distanciaMetros: number): string {
    return `${(distanciaMetros / 1000).toFixed(2)} `;
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

  formatDateTime(dateTimeString: string): string {
    const date = new Date(dateTimeString);
        const options: Intl.DateTimeFormatOptions = {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        };
        return date.toLocaleDateString('es-ES', options).replace(',', '');
      }

  async buildArcGISStaticMapUrl(idTrazado: string | undefined): Promise<string> {
    if (!idTrazado) return '';

    const puntosDB = await this.registroLocationRepo.getLocationsByTrazado(idTrazado);
    if (!puntosDB || puntosDB.length === 0) return '';

    const puntos = puntosDB
      .map(p => ({ lat: Number(p.latitud), lng: Number(p.longitud) }))
      .filter(p => this.isValidCoordinate(p));

    if (puntos.length === 0) return '';

    if (puntos.length === 1) {
      return this.buildCenteredStaticMapUrl(puntos[0]);
    }

    return this.buildRouteStaticMapUrl(puntos);
  }

  private buildRouteStaticMapUrl(puntos: Array<{ lat: number; lng: number }>): string {
    const baseUrl = 'https://static-maps-api.arcgis.com/arcgis/rest/services/static-maps-service/beta/static-maps/arcgis/streets/along-a-route';
    const puntosSimplificados = this.simplificarPuntosParaMapaEstatico(puntos, 10);
    const route = puntosSimplificados.map(p => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(',');
    const params = new URLSearchParams({
      route,
      lineWidth: '4',
      lineColor: '2F6EEA',
      lineStyle: 'solid',
      startSymbolStyle: 'circle',
      startSymbolColor: '00B288',
      startSymbolLabel: 'I',
      endSymbolStyle: 'circle',
      endSymbolColor: 'D14343',
      endSymbolLabel: 'F',
      symbolScale: '0.8',
      mapImageWidth: '640',
      mapImageHeight: '240',
      mapImageFormat: 'png',
      padding: '12'
    });

    return `${baseUrl}?${params.toString()}`;
  }

  private buildCenteredStaticMapUrl(punto: { lat: number; lng: number }): string {
    const baseUrl = 'https://static-maps-api.arcgis.com/arcgis/rest/services/static-maps-service/beta/static-maps/arcgis/streets/centered-at';
    const params = new URLSearchParams({
      x: punto.lng.toFixed(6),
      y: punto.lat.toFixed(6),
      radius: '1000',
      symbolStyle: 'circle',
      symbolColor: '2F6EEA',
      mapImageWidth: '640',
      mapImageHeight: '240',
      mapImageFormat: 'png',
      padding: '12'
    });

    return `${baseUrl}?${params.toString()}`;
  }

  private isValidCoordinate(punto: { lat: number; lng: number }): boolean {
    return Number.isFinite(punto.lat)
      && Number.isFinite(punto.lng)
      && punto.lat >= -85.05
      && punto.lat <= 85.05
      && punto.lng >= -179.99
      && punto.lng <= 179.99;
  }

  private simplificarPuntosParaMapaEstatico(
    puntos: Array<{ lat: number; lng: number }>,
    maxVertices: number
  ): Array<{ lat: number; lng: number }> {
    if (puntos.length <= maxVertices) return puntos;
    if (maxVertices <= 2) return [puntos[0], puntos[puntos.length - 1]];

    const resultado: Array<{ lat: number; lng: number }> = [];
    const ultimoIndice = puntos.length - 1;

    for (let i = 0; i < maxVertices; i++) {
      const indice = Math.round((i * ultimoIndice) / (maxVertices - 1));
      const punto = puntos[indice];
      const ultimoAgregado = resultado[resultado.length - 1];

      if (!ultimoAgregado || ultimoAgregado.lat !== punto.lat || ultimoAgregado.lng !== punto.lng) {
        resultado.push(punto);
      }
    }

    return resultado;
  }

  async getArcGISStaticMap2www(idTrazado: string | undefined): Promise<string> {
    //const baseUrl = "https://static-maps-api.arcgis.com/arcgis/rest/services/static-maps-service/generate-map";   
    const baseUrl = "https://static-maps-api.arcgis.com/arcgis/rest/services/static-maps-service/beta/generate-map/arcgis/streets/centered-at";
      //const baseUrl = "https://static-maps-api.arcgis.com/arcgis/rest/services/static-maps-service/beta/generate-map/arcgis/streets/bbox";
       // const baseUrl = "https://static-maps-api.arcgis.com/arcgis/rest/services/static-maps-service/generate-map/arcgis/streets/bbox"
    if (!idTrazado) {
      return '';
    }

    // Obtener puntos de la base de datos
    const puntosDB = await this.registroLocationRepo.getLocationsByTrazado(idTrazado);
    if (!puntosDB || puntosDB.length === 0) return '';

    // Mapear puntos a formato {lat, lng}
    const puntosMapeados = puntosDB.map(p => ({ lat: p.latitud, lng: p.longitud }));
    
    // Simplificar puntos si es necesario
    const puntosSimplificados = this.simplificarPuntos(puntosMapeados);

    const lats = puntosMapeados.map(p => p.lat);
    const lngs = puntosMapeados.map(p => p.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const centroLat = (minLat + maxLat) / 2;
    const centroLng = (minLng + maxLng) / 2;

    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);
    // Usar el primer punto como centro del mapa
    const puntoCentral = puntosSimplificados[0];
    const lat = puntoCentral.lat;
    const lon = puntoCentral.lng;

    let zoomLevel = 14;
    if (maxDiff > 0.1) zoomLevel = 11;
    else if (maxDiff > 0.05) zoomLevel = 12;
    else if (maxDiff > 0.02) zoomLevel = 13;
  
    const pathConfig = "color:0,0,255;width:3"; 
    const pathCoordenadas = puntosSimplificados.map(p => `${p.lng.toFixed(3)},${p.lat.toFixed(3)}`).join(';');
    const path = `${pathConfig};${pathCoordenadas}`;
    const encodedPath = encodeURIComponent(path);
    
    console.log("Generando URL del mapa para idTrazado:", idTrazado);
    console.log("Puntos simplificados:", puntosSimplificados);

    try {
    //  return `${baseUrl}?lon=${centroLng}&lat=${centroLat}&mapImageWidth=400&mapImageHeight=250&zoomLevel=9`;
    return `${baseUrl}?lon=${centroLng}&lat=${centroLat}&mapImageWidth=400&mapImageHeight=250&markerSymbol=circle&zoomLevel=${zoomLevel}&path=${path}`;
    // return `${baseUrl}?basemap=arcgis/streets&center=${centroLng},${centroLat}&zoom=${zoomLevel}&size=400,250&path=${path}&f=image`;
     
    // return `${baseUrl}?xmin=${minLng}&ymin=${minLat}&xmax=${maxLng}&ymax=${maxLat}&mapImageWidth=400&mapImageHeight=250&path=${path}`;
  } catch (error) {
      console.error("Error al generar la URL del mapa estático:", error);
      return '';
    }
  }

  formatearCaminoArcGIS(puntos: any[]): string {
    const prefijo = "color:255,0,0,255;width:3"; // Rojo con ancho 3
    

    const coordenadas = puntos.map(p => `${p.lng},${p.lat}`).join(';');
    
    return `${prefijo};${coordenadas}`;
  }

simplificarPuntos(puntos: any[], tolerancia: number = 5): any[] {
  if (puntos.length <= 80) return puntos; // Si son pocos, no hace falta procesar
  if (puntos.length > 1000) tolerancia = 25;
  else if (puntos.length > 500) tolerancia = 15;

  const resultado = [];
  // Siempre mantenemos el punto inicial
  resultado.push(puntos[0]);

  // Tomamos puntos saltando según la 'tolerancia'
  for (let i = 1; i < puntos.length - 1; i += tolerancia) {
    resultado.push(puntos[i]);
  }

  // Siempre mantenemos el punto final para cerrar el trazado
  resultado.push(puntos[puntos.length - 1]);
  
  return resultado;
}


  async loadMore(event: InfiniteScrollCustomEvent) {
    const currentLength = this.displayedTrazados.length;
    const nextBatch = this.filteredTrazados.slice(currentLength, currentLength + 10);
    this.displayedTrazados = [...this.displayedTrazados, ...nextBatch];
    event.target.complete();

    await this.updateMapUrls();

    if (this.displayedTrazados.length >= this.filteredTrazados.length) {
      event.target.disabled = true;
    }
  }
 }
