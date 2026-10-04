import { Component, OnInit } from '@angular/core';

import { RouterModule,Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, tap } from 'rxjs';
import { catchError } from 'rxjs';

import { TreeTableModule } from 'primeng/treetable';
import { TreeNode } from 'primeng/api';
import { ColegioService } from '../../../core/services/colegios.services';
import { Localidad,ColegioDTO,COLUMNAS_TABLA,Column} from '../../../core/models/colegios.model';
import { InputTextModule } from 'primeng/inputtext';
import { InputOtpModule } from 'primeng/inputotp';
import { EstudianteService } from '../../../core/services/estudiante.service';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MenuItem } from 'primeng/api';
import { BreadcrumbModule } from 'primeng/breadcrumb';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { CatalogService } from '../../../core/services/catalogo.services';
import { SelectProvidersResponse, SelectProvider } from '../../../core/models/catalogo.models';
import { IonSelect, IonSelectOption, IonText } from '@ionic/angular/standalone';
@Component({
  selector: 'app-colegios',
  standalone: true,
  imports: [IonSelect, IonSelectOption, IonText, ConfirmDialogModule, FormsModule, ToastModule, TreeTableModule, InputTextModule, InputOtpModule, ButtonModule, IconFieldModule, InputIconModule, BreadcrumbModule, RouterModule],
  providers: [ConfirmationService, MessageService],
  templateUrl: './colegios.component.html',
  styleUrls: ['./colegios.component.css']
})
export class ColegiosComponent implements OnInit {
  
  localidades: Localidad[] = [];
  localidadSeleccionada?: Localidad | null =  null;
  
  customModalOptions = {
      cssClass: 'custom-select-modal',
      header: 'Seleccione Localidad ....'
    };

 
  datosPorLocalidad: Record<number, ColegioDTO[]> = {};
  treeTableData: TreeNode[] = [];
  cols: Column[] = [];
  catalogs!: Record<string, SelectProvider[]>;

  columFilter!: string[];
  filterMode = 'lenient';
  globalFilterValue: string = '';
  selectedNode: TreeNode | null = null;

  
  items: MenuItem[] | undefined;
  home: MenuItem | undefined;

   filterModes = [
        { label: 'Lenient', value: 'lenient' },
        { label: 'Strict', value: 'strict' }
    ];

  constructor(
    private estudianteService: EstudianteService,
    private colegioService: ColegioService,
    private router: Router,
    private messageService: MessageService,
    private catalogService: CatalogService
      
    ) { }


  
    ngOnInit(): void {

    this.items= [{ label: 'PAE' },{ label: 'Enrolamiento' }, { label: 'Colegios' }];
    this.home = { icon: 'pi pi-home', routerLink: ['/main'] };

    forkJoin({
     ResponseLocalidades: this.catalogService.getCatalogsB(['Localidades']).pipe(
        catchError(error => {
          this.messageService.add({severity:'error', summary: 'Error', detail: 'Error al cargar localidades'});
           return of({ catalogs: { 'Localidades': [] } } as SelectProvidersResponse);
        })
      ),
      colegios: this.colegioService.getColegiosTree().pipe(
        catchError(error => {
           this.messageService.add({severity:'error', summary: 'Error', detail: 'Error al cargar los colegios'});
           return of({} as Record<number, ColegioDTO[]>);
        })
      )
    }).subscribe(({ ResponseLocalidades, colegios }) => {
      this.localidades = ResponseLocalidades.catalogs['Localidades'] || [];
      this.datosPorLocalidad = colegios;
    });

     this.cols = COLUMNAS_TABLA;
     this.columFilter = this.cols.filter(col => col.filter).map(col => col.field);
  }

 
    onSeleccionarLocalidad(): void {
    if (!this.localidadSeleccionada) {
      this.treeTableData = [];
      return;
    }
     const colegios = this.datosPorLocalidad[this.localidadSeleccionada.key] || [];
    this.treeTableData = this.mapearColegiosATreeNodes(colegios);
   
  }

   private mapearColegiosATreeNodes(colegios: ColegioDTO[]): TreeNode[] {
    
    
    return colegios.map(colegio => ({
      
      data: {

    
        nombreinstitucion: colegio.nombreColegio,
        dane: colegio.daneColegio,
        ordensede: '-',
        idjornada: '-',
        nivelarbol: colegio.nivelArbol
      },
      children: colegio.sedes.map(sede => ({
        data: {
          nombreinstitucion: "Nombre Sede: " +sede.nombreSede,
          dane: sede.daneSede,
          ordensede: sede.ordenSede,
          idjornada: '-',
          nivelarbol: sede.nivelArbol
        },
        children: sede.jornadas.map(jornada => ({
          data: {
            nombreinstitucion: "Jornada: " + jornada.jornada,
            dane: sede.daneSede,
            ordensede: '-',
            idjornada: jornada.idJornada,
            nivelarbol: jornada.nivelArbol
          }
        }))
      }))
    }));
  }

onNodeSelect(event: any): void {
  this.estudianteService.clearEstudiantes();
  this.selectedNode = event.node;

}

consultarEstudiantes(): void {
  if (!this.localidadSeleccionada) {
    this.messageService.add({severity:'warn', summary: 'Advertencia', detail: 'Por favor, seleccione una localidad antes de consultar.'});
    return;
  }
  if (!this.selectedNode) {
    this.messageService.add({severity:'warn', summary: 'Advertencia', detail: 'Por favor, seleccione un colegio, sede o jornada antes de consultar.'});
    return;
  }

  let nombreColegio = '';
  let nombreSede = '';
  let Jornada = '';
  if (this.selectedNode?.data.nivelarbol === 1 ) {
      this.estudianteService.getEstudiantesPorColegio(this.selectedNode?.data.dane).subscribe();
      nombreColegio = `${this.selectedNode?.data.nombreinstitucion}`;
   } else if (this.selectedNode?.data.nivelarbol === 2 ) {
      this.estudianteService.getEstudiantesPorSede(this.selectedNode?.parent?.data.dane, this.selectedNode?.data.dane).subscribe();
      nombreColegio = `${this.selectedNode?.parent?.data.nombreinstitucion}`;
      nombreSede = `${this.selectedNode?.data.nombreinstitucion}`;
   } else if (this.selectedNode?.data.nivelarbol === 3 ) {
      nombreColegio = `${this.selectedNode?.parent?.parent?.data.nombreinstitucion}`;
      nombreSede = `${this.selectedNode?.parent?.data.nombreinstitucion}`;
      Jornada = `${this.selectedNode?.data.nombreinstitucion}`;
      this.estudianteService.getEstudiantesPorJornada(this.selectedNode?.data.dane, this.selectedNode?.data.idjornada).subscribe();
   }
  this.router.navigate(['enrollment/estudiantes'], { queryParams: { colegio: nombreColegio, sede: nombreSede, jornada : Jornada } });
  
}



}
