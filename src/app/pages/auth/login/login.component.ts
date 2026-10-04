import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageModule } from 'primeng/message';
import { ConfirmationService, MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { RolJWT } from '../../../core/models/auth.model';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonSpinner,
  IonText
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  lockClosedOutline,
  logInOutline,
  mailOutline,
  personOutline,
  personAddOutline
} from 'ionicons/icons';

import { HeaderInstitucionalComponent } from '../../layout/default-layout/header-institucional/header-institucional.component'
import { FooterInstitucionalComponent } from '../../layout/default-layout/footer-institucional/footer-institucional.component'

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, ToggleSwitchModule,
    ToastModule, MessageModule, ConfirmDialogModule,
    HeaderInstitucionalComponent, FooterInstitucionalComponent,
    IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonInput,
    IonItem, IonSpinner, IonText
  ],
  providers: [ConfirmationService, MessageService],
})
export class LoginComponent implements OnInit {
  useInstitutionalEmail: boolean = false;
  cargando: boolean = false;
  login: string = '';
  password: string = '';

  /** Roles disponibles tras el login exitoso (sólo se muestran si hay más de uno) */
  rolesDisponibles: RolJWT[] = [];

  constructor(
    private router: Router,
    private authService: AuthService,
    private messageService: MessageService,
    private cdr: ChangeDetectorRef,
  ) {
    addIcons({
      arrowBackOutline,
      lockClosedOutline,
      logInOutline,
      mailOutline,
      personOutline,
      personAddOutline
    });
  }
  
  irARegistro() {
    this.router.navigate(['/auth/registro']);
  }

  async loginLocal() {
    this.cargando = true;
    this.rolesDisponibles = [];
    try {
      await this.authService.login(this.login, this.password);
      await this.procesarRoles();
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error de autenticación',
        detail: err?.message ?? 'Error en la autenticación. Revise usuario y contraseña.'
      });
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  /**
   * Si hay 1 rol → carga permisos y navega al dashboard.
   * Si hay +1 rol → muestra el listado en el formulario para que el usuario elija.
   */
  private async procesarRoles(): Promise<void> {
    const roles = this.authService.getRolesFromToken();

    if (roles.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Sin roles asignados',
        detail: 'El usuario no tiene roles asignados. Contacte al administrador.'
      });
    } else if (roles.length === 1) {
      await this.seleccionarRol(roles[0]);
    } else {
      this.rolesDisponibles = roles;
      this.cdr.detectChanges(); // fuerza la actualización de la vista inmediatamente
    }
  }

  /** Llamado al hacer clic en un rol del listado */
  async seleccionarRol(rol: RolJWT): Promise<void> {
    this.cargando = true;
    try {
      localStorage.setItem('idRolActivo', String(rol.id));
      await firstValueFrom(this.authService.cargarPermisosPorRol(rol.id));
      this.router.navigate(['/main']);
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'No se pudieron cargar los permisos del rol. Intente de nuevo.'
      });
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async ngOnInit(): Promise<void> {
    await this.authService.loadTokenFromStorage();
    if (this.authService.getAccessTokenMemory()) {
      await this.procesarRoles();
    }
  }


}
