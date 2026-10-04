import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators} from '@angular/forms';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { Router, RouterLink } from '@angular/router';

import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';

import { RegistroService } from '../../../core/services/registro.service';
import { CatalogService } from '../../../core/services/catalogo.services';
import { TiposDocumento, RegistroFormDTO,
         TiposUsuario, 
         EquiposTrabajo, Localidades, Cargos,Colegios, GruposTrabajo, Terceros } from '../../../core/models/registro.model';

import { SelectProvider} from '../../../core/models/catalogo.models';
import { ToastModule } from 'primeng/toast';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { InputNumberModule } from 'primeng/inputnumber';
import { FieldsetModule } from 'primeng/fieldset';

import {
  CardBodyComponent,
  CardComponent,
  ColComponent,
  RowComponent,
  ContainerComponent
} from '@coreui/angular';

import { HeaderInstitucionalComponent } from '../../layout/default-layout/header-institucional/header-institucional.component'
import { FooterInstitucionalComponent } from '../../layout/default-layout/footer-institucional/footer-institucional.component'

@Component({
  selector: 'app-registro',
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.scss'],
  standalone: true,
  imports: [ReactiveFormsModule,MessageModule,CommonModule, FormsModule, ButtonModule, InputNumberModule, FieldsetModule, InputTextModule, SelectModule, ToastModule, ConfirmDialogModule, PasswordModule,
    CardBodyComponent,
    CardComponent,
    ColComponent,
    RowComponent,
    HeaderInstitucionalComponent,
    FooterInstitucionalComponent,
    RouterLink,
    ContainerComponent
  ],
   providers: [ConfirmationService, MessageService],
})

export class RegistroComponent {

  registro : RegistroFormDTO = {} as RegistroFormDTO;
  catalogs!: Record<string, SelectProvider[]>;
  

  tiposIdentificacion: TiposDocumento[] = [];
  tiposUsuario: TiposUsuario[] = [];
  equiposTrabajo: EquiposTrabajo[] = [];
  localidades : Localidades[] = [];  
  cargos: Cargos[] = [];
  colegiosCatalogo: Colegios[] = [];
  colegios: Colegios[] = [];
  gruposTrabajoCatalogo: GruposTrabajo[] = [];
  opcionesGrupoTrabajo: GruposTrabajo[] = [];
  tercerosCatalogo: Terceros[] = [];
  firmasInterventoria: Terceros[] = [];
  operadoresLogisticosCatalogo: Terceros[] = [];
  proveedoresAlimentosCatalogo: Terceros[] = [];
  proveedoresTransporteCatalogo: Terceros[] = [];
  equiposGestorTerritorialFiltrados: EquiposTrabajo[] = [];
  mostrarGrupoTrabajoNivelCentral = false;

  selectedTipoIdentificacion?: TiposDocumento | null = null;
  selectedEquipoTrabajo?: EquiposTrabajo | null = null;
  selectedTipoUsuario?: TiposUsuario | null = null;
  selectedLocalidad?: Localidades | null = null;
  selectedColegio?: Colegios | null = null;
  selectedGrupoTrabajo?: GruposTrabajo | null = null;
  selectedTercero?: Terceros | null = null;
  
  loading: boolean = false;
  RegistroForm: FormGroup;
  formSubmitted = false;
  form: any;

  constructor(
    private registroService: RegistroService,private fb: FormBuilder, 
    private catalogService: CatalogService, 
    private confirmationService: ConfirmationService, 
    private messageService: MessageService,
    private cdr: ChangeDetectorRef) {

      const controlOpcional = { value: null, disabled: true };
    
      this.RegistroForm = this.fb.group({
        email: ['',[Validators.required, Validators.email]],
        emailConfirm: ['',[Validators.required, Validators.email]],
        nombres: ['',[Validators.required]],
        apellidos: ['',[Validators.required]],
        tipoIdentificacion: ['',[Validators.required]],
        identificacion: ['',[Validators.required,Validators.pattern('^[0-9]+$')]],
        telefono: ['',[Validators.required, Validators.pattern('^[0-9]+$')]],
        password: ['',[Validators.required,this.passwordStrengthValidator()]],
        passwordConfirm: ['',[Validators.required]],
        tipoUsuario: ['',[Validators.required]],
        equipoTrabajo: [controlOpcional],
        grupoTrabajo: [controlOpcional],
        cargo: [controlOpcional],
        localidad: [controlOpcional],
        colegio: [controlOpcional],
        tercero: [controlOpcional]},

        {validators: [this.emailsValidator(), this.passwordValidator()]});

       
  
  }

     ngOnInit(): void {
     this.catalogService.getCatalogs(
      ['TiposUsuario', 
      'TiposDocumento','EquiposTrabajo','Localidades','Cargos','GruposTrabajo','Terceros']).subscribe(data => {
       this.tiposUsuario = data.catalogs['TiposUsuario'] || [];
       this.tiposIdentificacion = (data.catalogs['TiposDocumento'] || []).filter(t => t.key === 1 || t.key === 3);
       this.equiposTrabajo = data.catalogs['EquiposTrabajo'] || [];
       this.localidades = data.catalogs['Localidades'] || [];
        this.cargos = data.catalogs['Cargos'] || [];
       this.gruposTrabajoCatalogo = data.catalogs['GruposTrabajo'] || [];
       this.tercerosCatalogo = data.catalogs['Terceros'] || [];

       this.configurarCamposPorTipo(this.tipoUsuarioKey);
       this.cdr.detectChanges();
      });

      this.RegistroForm.get('tipoUsuario')?.valueChanges
          .subscribe(value => {
          this.configurarCamposPorTipo(value?.key);
        });

      this.RegistroForm.get('localidad')?.valueChanges
          .subscribe(value => {
          const localidadId = value?.key ?? value;
          this.actualizarColegiosPorLocalidad(localidadId);
        });

      this.RegistroForm.get('equipoTrabajo')?.valueChanges
          .subscribe(value => {
          const equipoKey = value?.key ?? value?.value ?? value;
          this.actualizarGruposTrabajoPorEquipo(equipoKey);
         });
    }

  onSubmit() {
    this.formSubmitted = true;

    if (this.RegistroForm.invalid) {
      this.RegistroForm.markAllAsTouched();
      return;
    }

    const raw = this.RegistroForm.getRawValue();

    const payload: RegistroFormDTO = {
      email:              raw.email,
      emailConfirm:       raw.emailConfirm,
      password:           raw.password,
      passwordConfirm:    raw.passwordConfirm,
      nombres:            raw.nombres,
      apellidos:          raw.apellidos,
      tipoIdentificacion: raw.tipoIdentificacion?.key ?? raw.tipoIdentificacion,
      identificacion:     raw.identificacion,
      telefono:           raw.telefono,
      tipoUsuario:        raw.tipoUsuario?.key ?? raw.tipoUsuario,
      equipoTrabajo:      raw.equipoTrabajo?.key  ?? null,
      grupoTrabajo:       raw.grupoTrabajo?.key   ?? null,
      cargo:              raw.cargo?.key           ?? null,
      localidad:          raw.localidad?.key       ?? null,
      colegio:            raw.colegio?.key         ?? null,
      tercero:            raw.tercero?.key         ?? null,
    };

    this.loading = true;

    this.registroService.register(payload).subscribe({
      next: (res) => {
        this.loading = false;
        this.messageService.add({
          severity: 'success',
          summary: res.status,
          detail: res.message
        });
        this.RegistroForm.reset();
        this.formSubmitted = false;
      },
      error: (err) => {
        this.loading = false;
        const mensaje = err?.message ?? err?.mensaje ?? 'Ocurrió un error al procesar el registro.';
        this.messageService.add({
          severity: 'error',
          summary: err?.status ?? 'Error',
          detail: mensaje
        });
      }
    });
  }


   onSeleccionarDocumento(): void {
    const tipoId = this.RegistroForm.get('tipoIdentificacion')?.value;
   
   }

    onSeleccionarTipoUsuario(): void {
    const tipoUsuario = this.RegistroForm.get('tipoUsuario')?.value;
   }

  isInvalid(controlName: string) {
        const control = this.RegistroForm.get(controlName);
        return control?.invalid && (control.touched || this.formSubmitted);
    }
  enviarRegistro() {
    if (!this.selectedTipoIdentificacion) {
      return;
    }
   }

   emailsValidator(): ValidatorFn {
        return (group: AbstractControl): ValidationErrors | null => {
            const email = group.get('email')?.value;
            const emailConfirm = group.get('emailConfirm')?.value;

            if (!email || !emailConfirm) {
            return null;
            }
             return email === emailConfirm ? null : { emailCoincide: true };
        };
        
   }

   passwordValidator(): ValidatorFn {
   return (group: AbstractControl): ValidationErrors | null => {

    const password = group.get('password')?.value;
    const confirm = group.get('passwordConfirm')?.value;

    if (!password || !confirm) return null;

    return password === confirm ? null : { passwordCoincide: true };
     };
    }

   passwordStrengthValidator(): ValidatorFn {
      return (control: AbstractControl): ValidationErrors | null => {

        const value = control.value;

        if (!value) return null;

        const hasNumber = /[0-9]/.test(value);
        const hasLetter = /[a-z]/.test(value);
        const hasUpperCase = /[A-Z]/.test(value);
        const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);

        const valid = hasNumber && hasLetter && hasUpperCase && hasSpecial;

       return valid ? null : { passwordStrength: true };
     };
 }

 configurarCamposPorTipo(tipo: number | null) {

  const campos = [
    'equipoTrabajo',
    'grupoTrabajo',
    'cargo',
    'localidad',
    'colegio',
    'tercero'
  ];


    campos.forEach(campo => {
      const control = this.RegistroForm.get(campo);
      control?.clearValidators();
      control?.setValue(null);
      control?.disable();
      control?.updateValueAndValidity();
    });

    this.colegios = [];
    this.opcionesGrupoTrabajo = [];
    this.firmasInterventoria = [];
    this.operadoresLogisticosCatalogo = [];
    this.proveedoresAlimentosCatalogo = [];
    this.proveedoresTransporteCatalogo = [];
    this.equiposGestorTerritorialFiltrados = [];
    this.mostrarGrupoTrabajoNivelCentral = false;


  switch (tipo) {

    case 1:
      this.activarRequerido('equipoTrabajo');
      this.activarRequerido('cargo');
      this.actualizarGruposTrabajoPorEquipo();
      this.activarRequerido('grupoTrabajo');
      break;
    case 2:
      this.equiposGestorTerritorialFiltrados = this.filtrarEquiposTrabajoPorKeys([3, 4]);
      this.activarRequerido('equipoTrabajo');
       break;
    case 3:
      this.cargarCatalogoColegiosSiEsNecesario();
      this.activarRequerido('localidad');
      this.actualizarColegiosPorLocalidad();
      break;

    case 5:
      this.firmasInterventoria = this.filtrarTercerosPorGrupos(['5', '6']);
      this.activarRequerido('tercero');
      this.opcionesGrupoTrabajo = this.filtrarGruposTrabajoPorGrupo('5');
      this.activarRequerido('grupoTrabajo');
      break;

    case 6:
      this.operadoresLogisticosCatalogo = this.filtrarTercerosPorGrupo('2');
      this.activarRequerido('tercero');
      break;

    case 7:
      this.proveedoresAlimentosCatalogo = this.filtrarTercerosPorGrupo('1');
      this.activarRequerido('tercero');
      break;

    case 8:
    case 9:
    case 10:
      this.proveedoresTransporteCatalogo = this.filtrarTercerosPorGrupo('4');
      this.activarRequerido('tercero');
      break;
  }
}

   filtrarGruposTrabajoPorGrupo(grupo: string): GruposTrabajo[] {

  return this.gruposTrabajoCatalogo.filter(item => this.coincideGrupo(item.group, grupo));
  }



  filtrarTercerosPorGrupo(grupo: string): Terceros[] {
    return this.tercerosCatalogo.filter(item => this.coincideGrupo(item.group, grupo));
  }

  filtrarTercerosPorGrupos(grupos: string[]): Terceros[] {
    return this.tercerosCatalogo.filter(item => grupos.some(grupo => this.coincideGrupo(item.group, grupo)));
  }

  filtrarEquiposTrabajoPorKeys(keys: number[]): EquiposTrabajo[] {
    return this.equiposTrabajo.filter(item => keys.includes(item.key));
  }

  cargarCatalogoColegiosSiEsNecesario(): void {
    if (this.colegiosCatalogo.length > 0) {
      return;
    }

    this.catalogService.getCatalogs(['ColegiosXLocalidad']).subscribe(data => {
      this.colegiosCatalogo = data.catalogs['ColegiosXLocalidad'] || [];

      if (this.esInstitucionEducativa) {
        const localidadSeleccionada = this.RegistroForm.get('localidad')?.value?.key;
        this.actualizarColegiosPorLocalidad(localidadSeleccionada);
      }
    });
  }

  coincideGrupo(groupValue: string | number | null | undefined, grupo: string): boolean {
    return String(groupValue ?? '').trim() === String(grupo).trim();
  }

  actualizarGruposTrabajoPorEquipo(grupoKey?: number | string | null) {

      const controlGrupo = this.RegistroForm.get('grupoTrabajo');
      controlGrupo?.setValue(null);
      controlGrupo?.clearValidators();
      controlGrupo?.disable();
      this.opcionesGrupoTrabajo = [];
      this.mostrarGrupoTrabajoNivelCentral = false;

      if (!this.esNivelCentral) {
        controlGrupo?.updateValueAndValidity();
        return;
      }

      const grupoKeyNormalizado = Number(grupoKey);
      const grupo = grupoKeyNormalizado === 3 || grupoKeyNormalizado === 4 ? String(grupoKeyNormalizado) : '';

      if (!grupo) {
        controlGrupo?.updateValueAndValidity();
        return;
      }

      this.mostrarGrupoTrabajoNivelCentral = true;

      this.opcionesGrupoTrabajo = this.filtrarGruposTrabajoPorGrupo(grupo);

      controlGrupo?.enable();
      controlGrupo?.setValidators([Validators.required]);

      controlGrupo?.updateValueAndValidity();
    }

    actualizarColegiosPorLocalidad(localidadId?: number | null) {
     const controlColegio = this.RegistroForm.get('colegio');

      controlColegio?.setValue(null);
      controlColegio?.clearValidators();
      controlColegio?.disable();

      if (!this.esInstitucionEducativa || !localidadId) {
        this.colegios = [];
        controlColegio?.updateValueAndValidity();
        return;
      }

      this.colegios = this.colegiosCatalogo.filter(colegio => this.coincideGrupo(colegio.group, String(localidadId)));

      if (this.colegios.length > 0) {
        controlColegio?.enable();
        controlColegio?.setValidators([Validators.required]);
      }

      controlColegio?.updateValueAndValidity();
    }

    activarRequerido(nombre: string) {

      const control = this.RegistroForm.get(nombre);

      control?.enable();
      control?.setValidators([Validators.required]);
      control?.updateValueAndValidity();
    }

    get tipoUsuarioKey(): number | null {
    return this.RegistroForm.get('tipoUsuario')?.value?.key ?? null;
   }

    get equipoTrabajoLabel(): string | null {
   return this.RegistroForm.get('equipoTrabajo')?.value?.label ?? null;
   }

   get esNivelCentral(): boolean {
  return this.tipoUsuarioKey === 1;
}

    get esGestorTerritorial(): boolean {
      return this.tipoUsuarioKey === 2;
    }

    get esInstitucionEducativa(): boolean {
      return this.tipoUsuarioKey === 3;
    }

    get esInterventoria(): boolean {
      return this.tipoUsuarioKey === 5;
    }

    get requiereGrupoTrabajo(): boolean {
      return this.esNivelCentral && this.mostrarGrupoTrabajoNivelCentral;
    }

    get esOperadorLogistico(): boolean {
      return this.tipoUsuarioKey === 6;
    }

    get esProveedorAlimentos(): boolean {
      return this.tipoUsuarioKey === 7;
    }

    get esProveedorTransporte(): boolean {
       return this.tipoUsuarioKey === 8 || this.tipoUsuarioKey === 9 || this.tipoUsuarioKey === 10;
    }

}