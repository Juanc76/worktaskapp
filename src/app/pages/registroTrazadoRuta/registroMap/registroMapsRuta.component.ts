import { Component, OnInit, ViewChild, ElementRef, Input } from '@angular/core';
import { Router } from '@angular/router';
import { ActivatedRoute} from '@angular/router';

import { RegistroLocationRutaPMERepository } from '../../../core/repositories/registroLocationRutaPME.repository';

@Component({
  selector: 'app-mapa-seguimiento',
  template: `
    <div #mapCanvas style="height: 100%; width: 100%; "></div>
    <button (click)="salirDelMapa()" class="btn-salir">Salir</button>
  `,
  standalone: true,
  styles: [`
    .btn-salir {
      position: absolute;
      top: 25px;
      right: 10px;
      z-index: 1000;
      background-color: #ff4d4d;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
    }
    .btn-salir:hover {
      background-color: #ff1a1a;
    }
  `]
})

export class MapSeguimientoComponent implements OnInit {
  @ViewChild('mapCanvas', { static: true }) mapElement!: ElementRef;
  @Input() idTrazado!: string;

  map!: google.maps.Map;
  polyline!: google.maps.Polyline;
  busMarker!: google.maps.Marker;

  constructor(
    private route: ActivatedRoute,
    private registroLocationRutaPMERepository: RegistroLocationRutaPMERepository,
    private router: Router) {}

  async ngOnInit() {
     this.idTrazado = this.route.snapshot.paramMap.get('id') ?? '';
     console.log('ID de Servicio recibido:', this.idTrazado);
    this.initMap();
    await this.dibujarRuta();
  }

  initMap() {
    const mapOptions: google.maps.MapOptions = {
      center: { lat: 4.609, lng: -74.081 }, 
      zoom: 12,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      disableDefaultUI: false 
    };

    this.map = new google.maps.Map(this.mapElement.nativeElement, mapOptions);

    // Inicializar la línea del recorrido (Trazado)
    this.polyline = new google.maps.Polyline({
      path: [],
      geodesic: true,
      strokeColor: '#3880ff',
      strokeOpacity: 1.0,
      strokeWeight: 4,
      map: this.map
    });

    // Marcador del Bus
    this.busMarker = new google.maps.Marker({
      position: { lat: 0, lng: 0 },
      map: this.map,
      icon: {
        url: 'pi pi-truck', 
        scaledSize: new google.maps.Size(40, 40)
      }
    });
  }

  async dibujarRuta() {

    const puntos = await this.registroLocationRutaPMERepository.getLocationsByTrazado(this.idTrazado);
    
    if (puntos.length > 0) {
      const path = puntos.map(p => ({ lat: p.latitud, lng: p.longitud }));
      
      this.polyline.setPath(path);

      // 3. Posicionar bus en el último punto
      const ultimaPos = path[path.length - 1];
      this.busMarker.setPosition(ultimaPos);
      this.map.panTo(ultimaPos);
      
      // 4. Dibujar paraderos (Llamada a tu nueva tabla de control)
     // await this.dibujarParaderos();
    }
  }

  // async dibujarParaderos() {
  //   const paraderos = await this.dbService.getControlParaderos(this.idTrazado);
    
  //   paraderos.forEach(p => {
  //     new google.maps.Marker({
  //       position: { lat: p.latitud, lng: p.longitud },
  //       map: this.map,
  //       title: p.nombreParadero,
  //       icon: {
  //         url: p.visitado ? 'assets/icon/check-green.png' : 'assets/icon/marker-red.png',
  //         scaledSize: new google.maps.Size(30, 30)
  //       }
  //     });
  //   });
  // }

  salirDelMapa() {
  this.router.navigate(['/registroTrazadoRuta']); // Cambia '/otra-pagina' por la ruta deseada
}
}
