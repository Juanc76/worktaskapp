import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute,RouterLink } from '@angular/router';

import { BeneficiariosRutaPMERepository } from '../../../core/repositories/beneficiariosRutaPME.repository';
import { DetalleBeneficiarios } from '../../../core/models/detalleBeneficiarios.model';

import { BreadcrumbModule } from 'primeng/breadcrumb';
import { MenuItem } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { RouterModule } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

import { IonCard, IonCardContent, IonChip, IonText, IonContent } from '@ionic/angular/standalone';


@Component({
  selector: 'app-detalle-beneficiarios',
   standalone: true,
  imports: [CommonModule, FormsModule, BreadcrumbModule, ButtonModule, RouterModule, ToastModule, RouterLink,
     ConfirmDialogModule, IonCard, IonCardContent, IonChip, IonText, IonContent],
   templateUrl: './detalleBeneficiarios.component.html',
   styleUrls: ['./detalleBeneficiarios.component.css'],
   providers: [ConfirmationService, MessageService]
})
export class DetalleBeneficiariosComponent implements OnInit, OnChanges {

  @Input() rutaId: number | null = null;
  @Input() inModal: boolean = false;

  rutaIdResolved: number | null = null;

  // Breadcrumb
  items: MenuItem[] | undefined;
  home: MenuItem | undefined;

  beneficiarios: DetalleBeneficiarios[] = [];
constructor(
    private route: ActivatedRoute,
    private beneficiariosRutaPMERepository: BeneficiariosRutaPMERepository

   ) {}
    async ngOnInit() {
    this.items= [{ label: 'PME' },{ label: 'Detalle Beneficiarios' }];
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
    this.rutaIdResolved = rutaId;
    this.beneficiarios = await this.beneficiariosRutaPMERepository.getBeneficiariosRutaPMEByRutaId(rutaId);
  }

}