import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';


import { DetalleRutaPMERepository} from '../../../core/repositories/detalleRutaPME.repository';
import { DetalleRuta } from '../../../core/models/detalleRuta.model';

import { BreadcrumbModule } from 'primeng/breadcrumb';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';


@Component({
  selector: 'app-detalle-ruta',
   standalone: true,
  imports: [CommonModule, FormsModule, BreadcrumbModule, ButtonModule, RouterModule, ToastModule, RouterLink],
   templateUrl: './detalleRuta.component.html',
   styleUrls: ['./detalleRuta.component.css'],
   providers: [MessageService]
})
export class DetalleRutaComponent implements OnInit, OnChanges {

  @Input() rutaId: number | null = null;
  @Input() inModal: boolean = false;

  // Breadcrumb
  items: MenuItem[] | undefined;
  home: MenuItem | undefined;

  detalleRuta: DetalleRuta = {
    idRuta: 0,
    rutaEscolar: '',
    localidad: '',
    segmentoGeografico: '',
    tipoRuta: '',
    tipologiaRuta: '',
    zonaOperacion: '',
    movilidadReducida: false,
    daneColegio: '',
    nombreColegio: '',
    sedeEducativa: '',
    jornadaEducativa: '',
    inicioRecorrido1: '',
    inicioJornada: '',
    finJornada: '',
    inicioRecorrido2: '',
    horasRecorrido1: 0,
    horasRecorrido2: 0,
    operaLunes: false,
    operaMartes: false,
    operaMiercoles: false,
    operaJueves: false,
    operaViernes: false,
    operaSabado: false,
    operaDomingo: false,
    estadoRuta: ''
  };
constructor(
    private route: ActivatedRoute,
    private detalleRutaRepository: DetalleRutaPMERepository
  ) {}

    
    async ngOnInit() {
    this.items = [{ label: 'PME' }, { label: 'Detalle Ruta' }];
    this.home = { icon: 'pi pi-home', routerLink: '/' };
    const rutaFromRoute = Number(this.route.snapshot.paramMap.get('ruta'));
    const resolvedRuta = this.rutaId ?? (Number.isFinite(rutaFromRoute) ? rutaFromRoute : null);
    if (resolvedRuta !== null) {
      await this.applyRutaId(resolvedRuta);
    }
  } 

      ngOnChanges(changes: SimpleChanges): void {
        if (changes['rutaId'] && this.rutaId !== null && this.rutaId !== undefined) {
          void this.applyRutaId(this.rutaId);
        }
      }

      private async applyRutaId(rutaId: number) {
        // Cargar desde SQLite; si no existe aún, al menos reflejamos el id seleccionado.
        const detalle = await this.detalleRutaRepository.getDetalleRutaPMEByRutaId(rutaId);
        if (detalle) {
          this.detalleRuta = detalle;
          return;
        }

        this.detalleRuta = {
          ...this.detalleRuta,
          idRuta: rutaId,
        };
      }

  
}