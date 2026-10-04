import { Component, OnInit, ViewChild, ElementRef, Input, OnDestroy } from '@angular/core';

import { BreadcrumbModule } from 'primeng/breadcrumb';

import { RegistroLocationRutaPMERepository } from '../../../core/repositories/registroLocationRutaPME.repository';
import { ActivatedRoute, Router,RouterModule  } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import esriConfig from "@arcgis/core/config";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import Graphic from "@arcgis/core/Graphic";
import Polyline from "@arcgis/core/geometry/Polyline";
import Point from "@arcgis/core/geometry/Point";
import Basemap from "@arcgis/core/Basemap";
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-mapa-arcgis',
  templateUrl: './registroMapsArcgis.component.html',
  styleUrls: ['./registroMapsArcgis.component.css'],
  standalone: true,
  imports: [BreadcrumbModule, ButtonModule, ToastModule, ProgressSpinnerModule,RouterModule ],
  providers: [MessageService]
})
export class MapaArcgisComponent implements OnInit, OnDestroy {
   items: MenuItem[] | undefined;
    home: MenuItem | undefined;

  @ViewChild('mapCanvas', { static: true }) private mapViewEl!: ElementRef;
  @Input() idTrazado!: string;

  private view!: MapView;
  private removeMapGestureListeners: Array<() => void> = [];

  constructor(
    private locationRepo: RegistroLocationRutaPMERepository, 
    private route: ActivatedRoute, 
    private router: Router,
    private messageService: MessageService) {
   

    this.getArcgisApiKey();
  }

  private getArcgisApiKey(): string {
    return esriConfig.apiKey = environment.arcgisApiKey.trim();
  }
  async ngOnInit() {

    this.items= [{ label: 'PME' },{ label: 'Trazado Ruta' }];
    this.home = { icon: 'pi pi-home', routerLink: '/main' };

    this.idTrazado = this.route.snapshot.paramMap.get('id') ?? '';
     console.log('ID de Servicio recibido:', this.idTrazado);

    try {  

    const map = new Map({
      basemap: 'osm'
    });

    this.view = new MapView({
      container: this.mapViewEl.nativeElement,
      map: map,
      zoom: 14,
      center: [-74.081, 4.609] // Centro inicial (Bogotá como ejemplo)
    });

    await this.view.when();
    this.cargarDatosDeRuta();
  }catch (error) {
    console.error("Error al inicializar ArcGIS:", error);
  }
}
  async cargarDatosDeRuta() {
    // 1. Obtener los puntos del trazado desde tu SQLite
    const puntosGps = await this.locationRepo.getLocationsByTrazado(this.idTrazado);
    console.log('Puntos GPS obtenidos:', puntosGps);
    if (puntosGps.length > 0) {
      this.dibujarTrazado(puntosGps);
    }

    // 2. Obtener y dibujar los paraderos (Visitados vs Pendientes)
    // const paraderos = await this.locationRepo.getControlParaderos(this.idTrazado);
    // this.dibujarParaderos(paraderos);
  }

  private dibujarTrazado(puntos: any[]) {
    const paths = puntos.map(p => [p.longitud, p.latitud]);
    
    const polyline = new Polyline({
      paths: [paths] as any,
      spatialReference: { wkid: 4326 }
    });

    const lineGraphic = new Graphic({
      geometry: polyline,
      symbol: {
        type: "simple-line",
        color: [56, 128, 255, 0.8], // Azul traslúcido
        width: 4
      } as any
    });

    this.view.graphics.add(lineGraphic);
    this.view.goTo(polyline); // Ajuste automático del zoom (FitBounds)
  }

  // private dibujarParaderos(paraderos: any[]) {
  //   paraderos.forEach(p => {
  //     const point = new Point({ longitude: p.longitud, latitude: p.latitud });
      
  //     const markerGraphic = new Graphic({
  //       geometry: point,
  //       symbol: {
  //         type: "simple-marker",
  //         // Verde si visitado (1), Rojo si pendiente (0)
  //         color: p.visitado ? "green" : "red",
  //         outline: { color: "white", width: 2 },
  //         size: "12px"
  //       } as any,
  //       attributes: p // Guardamos la info del paradero para mostrarla al tocarlo
  //     });

  //     this.view.graphics.add(markerGraphic);
  //   });
  // }

  ngOnDestroy() {
    if (this.view) this.view.destroy();
  }

   salirDelMapa() {
  this.router.navigate(['/registroTrazadoRuta']); // Cambia '/otra-pagina' por la ruta deseada
}
}
