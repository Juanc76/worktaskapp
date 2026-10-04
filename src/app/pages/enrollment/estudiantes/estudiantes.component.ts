import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import { RouterModule,Router } from '@angular/router';
import { ActivatedRoute,RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';


import { FormsModule } from '@angular/forms';
import { Estudiantes } from '../../../core/models/estudiante.model';
import { EstudianteService } from '../../../core/services/estudiante.service';
import { EstudianteSelectService } from '../../../core/services/estudianteSelect.sevice';

import { InputTextModule } from 'primeng/inputtext';
import { InputOtpModule } from 'primeng/inputotp';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { IonContent, IonList, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent, IonInfiniteScroll, IonInfiniteScrollContent, InfiniteScrollCustomEvent, IonIcon, IonChip, IonLabel, IonHeader, IonToolbar, IonSelect, IonSelectOption } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircle, schoolOutline, personOutline, maleOutline, femaleOutline } from 'ionicons/icons';
@Component({
  selector: 'app-estudiantes',
  standalone: true,
  imports: [IonSelect, IonSelectOption, IonHeader, IonToolbar, IonLabel, IonChip, IonIcon, CommonModule, FormsModule, ButtonModule, BreadcrumbModule, InputTextModule, InputOtpModule, RouterModule, RouterLink, IconFieldModule, InputIconModule, IonContent, IonList, IonCard, IonCardContent, IonInfiniteScroll, IonInfiniteScrollContent],
  templateUrl: './estudiantes.component.html',
  styleUrls: ['./estudiantes.component.css']
})

export class EstudiantesComponent implements OnInit, AfterViewInit, OnDestroy {

  private estudiantesSubscription: Subscription | undefined;
  @ViewChild(IonInfiniteScroll) infiniteScroll?: IonInfiniteScroll;

  estudiantes: Estudiantes[] = [];
  filteredEstudiantes: Estudiantes[] = [];
  displayedEstudiantes: Estudiantes[] = [];
  
  colegio : string = '';
  sede : string = '';
  jornada : string = ''
  globalFilterValue: string = '';
  sortField: string = '';
  selectedGrado: string = '';
  grados: string[] = [];
  showFilters: boolean = false;
  
  items: MenuItem[] | undefined;
  home: MenuItem | undefined;
  
  customAlertOptions = {
    cssClass: 'custom-alert-class',
    cancelText: 'Cancelar',
    okText: 'Aceptar'
  };

   customModalOptions = {
    cssClass: 'custom-select-modal'
  };

  constructor(private estudianteService: EstudianteService,
    //private tabService: TabService,
     private estudianteSelect: EstudianteSelectService,
     private route: ActivatedRoute,
     private router: Router
  ) {
      addIcons({schoolOutline,personOutline,checkmarkCircle,maleOutline,femaleOutline});

   
  } 

ngOnInit(): void {

    this.items= [{ label: 'PAE' },{ label: 'Enrolamiento' }, { label: 'Estudiantes' }];
    this.home = { icon: 'pi pi-home', routerLink: ['/main'] };
    
    this.estudiantesSubscription = this.estudianteService.estudiantes$.subscribe(
    (data: Estudiantes[] | null | undefined) => {
    const displayedCount = Math.max(this.displayedEstudiantes.length, 10);

    if (data) {
      this.estudiantes = data.map(est => ({
                                                            ...est,
                                                            searchKey: (
                                                              (est.nombre1 ?? '') + ' ' +
                                                              (est.nombre2 ?? '') + ' ' +
                                                              (est.apellido1 ?? '') + ' ' +
                                                              (est.apellido2 ?? '') + ' ' +
                                                              (est.numeroDocumento ?? '') + ' ' +
                                                              (est.perID ?? '') + ' ' +
                                                              (est.grado ?? '')
                                                            ).toLowerCase(),
                                                             gradoKey: this.normalizeKey(est.grado)
                                                          }))
      this.grados = this.buildGrados(this.estudiantes);
      this.applyCurrentFilters(displayedCount);
    } else {
      this.estudiantes = []; 
      this.grados = [];
      this.filteredEstudiantes = [];
      this.displayedEstudiantes = [];
      this.resetInfiniteScroll();
    }
    });
     

      this.route.queryParamMap.subscribe(params => {
      this.colegio = params.get('colegio') ?? '' ;
      this.sede = params.get('sede') ?? '';
      this.jornada = params.get('jornada') ?? '';

      });

  }

  ngOnDestroy(): void {
    //  desuscribirse para evitar fugas de memoria.
    this.estudiantesSubscription?.unsubscribe();
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.resetInfiniteScroll());
  }

  verDetalleEstudiante(selectedEstudiante: any) : void {
   if (selectedEstudiante) {
      this.estudianteSelect.setEstudiante(selectedEstudiante);
      this.router.navigate(['enrollment/estudiante-detalle'], { queryParamsHandling: 'preserve' });
    }
  }

  filterEstudiantes() {
    this.applyCurrentFilters();
  }

  private applyCurrentFilters(displayCount = 10): void {
    const filterValue = this.globalFilterValue?.toLowerCase() ?? '';
    const selectedGradoKey = this.normalizeKey(this.selectedGrado);

    this.filteredEstudiantes = this.estudiantes.filter(est => {
      
      const matchesGlobal =
      !filterValue || est.searchKey?.includes(filterValue);

    const matchesGrado =
     !selectedGradoKey || est.gradoKey?.includes(selectedGradoKey);

    return matchesGlobal && matchesGrado;
    });

    this.sortData();
    this.resetDisplayedEstudiantes(displayCount);
  }

  clear() {
    this.filteredEstudiantes = this.estudiantes;
    this.resetDisplayedEstudiantes();
    this.globalFilterValue = '';
    this.sortField = '';
    this.selectedGrado = '';
  }

  sortData() {
    if (this.sortField) {
      this.filteredEstudiantes.sort((a, b) => {
        const valA = a[this.sortField as keyof Estudiantes];
        const valB = b[this.sortField as keyof Estudiantes];
        if (valA && valB) {
          return valA.toString().localeCompare(valB.toString());
        }
        return 0;
      });
    }
  }

  loadMore(event: InfiniteScrollCustomEvent) {
    const currentLength = this.displayedEstudiantes.length;
    const nextBatch = this.filteredEstudiantes.slice(currentLength, currentLength + 10);
    this.displayedEstudiantes = [...this.displayedEstudiantes, ...nextBatch];
    event.target.complete();

    if (this.displayedEstudiantes.length >= this.filteredEstudiantes.length) {
      event.target.disabled = true;
    }
  }

  private resetDisplayedEstudiantes(displayCount = 10): void {
    this.displayedEstudiantes = this.filteredEstudiantes.slice(0, displayCount);
    this.resetInfiniteScroll();
  }

  private resetInfiniteScroll(): void {
    if (this.infiniteScroll) {
      this.infiniteScroll.disabled = this.displayedEstudiantes.length >= this.filteredEstudiantes.length;
    }
  }

  getIniciales(est: any): string {
  return `${est.nombre1?.[0] ?? ''}${est.apellido1?.[0] ?? ''}`.toUpperCase();
  }

  getColorFromName(name: string): string {
  const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ef4444'];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
 }

  normalizeKey(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
 }

 private buildGrados(estudiantes: Estudiantes[]): string[] {
  const unique = new Map<string, string>();

  const orderKeys = [
    ['-2', 'pre-jardin'],
    ['-1', 'Jardín I o A o Kinder'],
    ['0', 'Jardín II o B, Transición o Grado 0'],
    ['1', 'primero'],
    ['2', 'segundo'],
    ['3', 'tercero'],
    ['4', 'cuarto'],
    ['5', 'quinto'],
    ['6', 'sexto'],
    ['7', 'septimo'],
    ['8', 'octavo'],
    ['9', 'noveno'],
    ['10', 'decimo'],
    ['11', 'once'],
    ['12', 'doce', 'normal superior', 'doce normal superior'],
    ['13', 'trece', 'trece normal superior'],
    ['14', 'educacion discapacidad cognitiva no integrada'],
    ['15', 'educacion discapacidad auditiva no integrada'],
    ['16', 'educacion discapacidad visual no integrada'],
    ['17', 'educacion discapacidad motora no integrada'],
    ['18', 'educacion discapacidad multiple no integrada'],
    ['21', 'ciclo 1 adultos', 'ciclo1 adultos'],
    ['22', 'ciclo 2 adultos', 'ciclo2 adultos'],
    ['23', 'ciclo 3 adultos', 'ciclo3 adultos'],
    ['24', 'ciclo 4 adultos', 'ciclo4 adultos'],
    ['25', 'ciclo 5 adultos', 'ciclo5 adultos'],
    ['26', 'ciclo 6 adultos', 'ciclo6 adultos'],
    ['99', 'aceleracion del aprendizaje']
  ];

  const orderMap = new Map<string, number>();
  orderKeys.forEach((keys, index) => {
    keys.forEach(key => orderMap.set(this.normalizeKey(key), index));
  });

  estudiantes.forEach(est => {
    const raw = est.grado?.toString().trim();
    if (!raw) {
      return;
    }

    const key = this.normalizeKey(raw);
    if (key && !unique.has(key)) {
      unique.set(key, raw);
    }
  });

  return Array.from(unique.values()).sort((a, b) => {
    const keyA = this.normalizeKey(a);
    const keyB = this.normalizeKey(b);
    const orderA = orderMap.get(keyA);
    const orderB = orderMap.get(keyB);
    const hasOrderA = orderA !== undefined;
    const hasOrderB = orderB !== undefined;

    if (hasOrderA && hasOrderB) {
      return orderA - orderB;
    }

    if (hasOrderA) {
      return -1;
    }

    if (hasOrderB) {
      return 1;
    }

    return a.localeCompare(b);
  });
 }

 getColorClass(grado: string): string {
  const key = this.normalizeKey(grado);

  switch (key) {
    case '1':
    case 'primero':
      return 'color-primero';
    case '2':
    case 'segundo':
      return 'color-segundo';
    case '3':
    case 'tercero':
      return 'color-tercero';
    case '4':
    case 'cuarto':
      return 'color-cuarto';
    case '5':
    case 'quinto':
      return 'color-quinto';
    case '6':
    case 'sexto':
      return 'color-sexto';
    case '7':
    case 'septimo':
      return 'color-septimo';
    case '8':
    case 'octavo':
      return 'color-octavo';
    case '9':
    case 'noveno':
      return 'color-noveno';
    case '10':
    case 'decimo':
      return 'color-decimo';
    case '11':
    case 'once':
      return 'color-once';
    default:
      return 'color-default';
  }
 }

 getGeneroClass(genero: string): string {
  const key = this.normalizeKey(genero);

  switch (key) {
    case 'm':
    case 'masculino':
    case 'h':
    case 'hombre':
      return 'genero-masculino';
    case 'f':
    case 'femenino':
    case 'mujer':
      return 'genero-femenino';
    case 'o':
    case 'otro':
    case 'no especifica':
    case 'no especificado':
      return 'genero-otro';
    default:
      return 'genero-default';
  }
 }
}
