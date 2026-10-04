import { Component, OnInit } from '@angular/core';
import { RouterModule, Router } from '@angular/router';
import { MainMenuService } from '../../core/services/mainMenu.Service';
import { DatabaseService } from '../../core/services/database.service';
import { AuthService } from '../../core/auth/auth.service';
import { PermisosStateService } from '../../core/services/permisos-state.service';

import {ColegiosRepository } from '../../core/repositories/colegios.repository';
import {SedesEducativasRepository } from '../../core/repositories/sedesEducativas.repository';
import {SitiosEntregaRepository } from '../../core/repositories/sitiosEntrega.repository';
import {RutasRepository} from '../../core/repositories/rutas.repository';
import {GradosSitioEntregaRepository} from '../../core/repositories/gradosSitioEntrega.repository';


import { AsyncPipe, CommonModule } from '@angular/common';
import { TrackingService } from '../../core/services/tracking.Service';
import { TrackingBannerComponent } from '../registroTrazadoRuta/bannerTrazado/tracking-banner.component';
import {
  IonFooter,
  IonToolbar,
  IonTitle,
  IonContent,
  IonMenu,
  IonHeader,
  IonMenuButton,
  IonButtons,
  IonList,
  IonItem,
  IonMenuToggle
} from '@ionic/angular/standalone';
import { ButtonModule } from 'primeng/button';
import { firstValueFrom } from 'rxjs';
import { DeviceService } from '../../core/services/device.service';

@Component({
  selector: 'app-main-menu',
  standalone: true,
  imports: [RouterModule, CommonModule, AsyncPipe, TrackingBannerComponent,
     IonFooter, IonToolbar, IonTitle, IonContent, IonMenu, IonHeader, IonMenuButton, IonButtons,
     IonList, IonItem, IonMenuToggle, ButtonModule],
  templateUrl: './mainMenu.component.html',
  styleUrls: ['./mainMenu.component.css']
})
export class MainMenuComponent implements OnInit {

  isTracking$ = this.trackingService.isTrackingActive$();
  usuario: string | null = null;
  avatarUsuario = '';

  readonly menuOptions = [
    { label: 'Enrolamiento Estudiantes', route: 'enrollment', icon: 'pi pi-building', permissionCode: 'ENROLAMIENTO_VER' },
    { label: 'Registro Fotográfico PAE', route: 'registroEntregaPAE', icon: 'pi pi-camera', color: '#d1be12e0', permissionCode: 'PHOTO_PAE_VER' },
    { label: 'Registro Fotográfico PME', route: 'registroServicioPME', icon: 'pi pi-camera', color: '#d64f19', permissionCode: 'PHOTO_PME_VER' },
    { label: 'Registro Trazado Ruta PME', route: 'registroTrazadoRuta', icon: 'pi pi-map', permissionCode: 'TRAZADOS_RUTAS_VER' }
  ];
 
  constructor(
    private router: Router,
    private mainMenuService: MainMenuService,
    private dbService: DatabaseService,
    private colegiosRepository: ColegiosRepository,
    private sedesRepository: SedesEducativasRepository,
    private sitiosEntregaRepository: SitiosEntregaRepository,
    private gradosSitioEntregaRepository: GradosSitioEntregaRepository,
    private rutasRepository: RutasRepository,
    private trackingService: TrackingService,
    private deviceService: DeviceService,
    private authService: AuthService,
    private permisosState: PermisosStateService
    
  ) {}

  async ngOnInit() {
    await this.authService.loadTokenFromStorage();
    await this.loadUserFromToken();
    await this.loadPermissionsIfNeeded();
    await this.dbService.init(); 
    const idUser = await this.authService.getCurrentUserId();
    if (idUser !== null) {
      const usuario = String(idUser);
      await  this.syncColegiosAndSedes(usuario);
      await this.syncRutasByUsuario(usuario);
    } else {
      console.warn('No se encontro idUser en el JWT. No se sincronizan datos asignados al usuario.');
    }
     const deviceData = await this.deviceService.getDeviceData();
     console.log(deviceData.deviceId, deviceData.modelo, deviceData.plataforma)
  }

  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  getMenuLabel(route: string, fallback: string): string {
    const labels: Record<string, string> = {
      enrollment: 'Enrolamiento Estudiantes',
      registroEntregaPAE: 'Registro Fotografico PAE',
      registroServicioPME: 'Registro Fotografico PME',
      registroTrazadoRuta: 'Registro Trazado Ruta PME'
    };

    return labels[route] ?? fallback;
  }

  logout(): void {
    this.authService.logout();
  }

  tiene(codigo?: string): boolean {
    return !codigo || this.permisosState.tiene(codigo);
  }

  getPrimerNombre(nombre: string | null): string {
    return (nombre || 'Usuario').trim().split(/\s+/)[0] || 'Usuario';
  }

  private async loadPermissionsIfNeeded(): Promise<void> {
    if (this.permisosState.getPermisos().length > 0) {
      return;
    }

    const roles = this.authService.getRolesFromToken();

    if (roles.length === 0) {
      console.warn('El token no contiene roles. No se pueden cargar permisos del menú principal.');
      return;
    }

    const idRolGuardado = localStorage.getItem('idRolActivo');
    const idRol = idRolGuardado ? Number(idRolGuardado) : roles[0].id;

    await firstValueFrom(this.permisosState.cargarPermisosPorRol(idRol));
  }

  private async loadUserFromToken(): Promise<void> {
    const nombreUsuario = await this.authService.getCurrentUserName();

    if (!nombreUsuario) {
      return;
    }

    this.usuario = nombreUsuario;
    this.avatarUsuario = this.getInitials(this.usuario);
  }

  private getInitials(nombre: string | null): string {
    if (!nombre) {
      return '';
    }

    const partes = nombre.trim().split(/\s+/);
    const inicialNombre = partes[0]?.charAt(0) ?? '';
    const indiceApellido = partes.length >= 3 ? 2 : partes.length - 1;
    const inicialApellido = partes[indiceApellido]?.charAt(0) ?? '';

    return `${inicialNombre}${inicialApellido}`.toUpperCase();
  }

 async syncColegiosAndSedes(usuario: string) {
    const [colegios, sedes] = await Promise.all([
      firstValueFrom(this.mainMenuService.getColegiosByUser(usuario)),
      firstValueFrom(this.mainMenuService.getSedesByColegio(usuario))
    ]);

    console.log('Colegios recibidos de la API:', JSON.stringify(sedes));
    
    await this.colegiosRepository.saveColegios(colegios);
    await this.sedesRepository.saveSedes(sedes);

    const promesasSitios = sedes.map(sede => 
        firstValueFrom(this.mainMenuService.getSitiosEntregaPAEBySede(sede.idSede))
    );

    // const promesasGrados = sedes.map(sede => 
    //     firstValueFrom(this.mainMenuService.getGradosBySitioEntrega(sede.idSede))
    // );

    const resultadosSitios = await Promise.all(promesasSitios);
    // const resultadosGrados = await Promise.all(promesasGrados);

    // const [resultadosSitios, resultadosGrados] = await Promise.all([
    //   Promise.all(promesasSitios),
    //   Promise.all(promesasGrados)
    // ]);

    const todosLosSitios = resultadosSitios.flat().filter(s => s !== null);
    if (todosLosSitios.length > 0) {
      await this.sitiosEntregaRepository.saveSitiosEntrega(todosLosSitios);
    }

    // const todosLosGrados = resultadosGrados.flat().filter(s => s !== null);
    // if (todosLosGrados.length > 0) {
    //   await this.gradosSitioEntregaRepository.saveGrados(todosLosGrados);
    // }
  
  }

  async syncRutasByUsuario(usuario: string) {
    const rutas = await firstValueFrom(this.mainMenuService.getRutasByUsuario(usuario));
    if (rutas && rutas.length > 0) {
      await this.rutasRepository.saveRutas(rutas);
      console.log('Rutas sincronizadas correctamente.');
    } else {
      console.log('No se encontraron rutas para sincronizar.');
    }
  }
}
