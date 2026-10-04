import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class EstudianteSelectService {
  private readonly storageKey = 'seddbe.selectedEstudiante';
  private estudianteSource = new BehaviorSubject<any>(this.readStoredEstudiante());
  estudiante$ = this.estudianteSource.asObservable();

  setEstudiante(estudiante: any) {
    this.storeEstudiante(estudiante);
    this.estudianteSource.next(estudiante);
  }

  clearEstudiante() {
   this.removeStoredEstudiante();
   this.estudianteSource.next(null); 
 }

 private readStoredEstudiante(): any {
   try {
     const raw = window.sessionStorage.getItem(this.storageKey);
     return raw ? JSON.parse(raw) : null;
   } catch {
     return null;
   }
 }

 private storeEstudiante(estudiante: any): void {
   try {
     window.sessionStorage.setItem(this.storageKey, JSON.stringify(estudiante));
   } catch {
     // Si sessionStorage no esta disponible, se conserva el valor en memoria.
   }
 }

 private removeStoredEstudiante(): void {
   try {
     window.sessionStorage.removeItem(this.storageKey);
   } catch {
     // Si sessionStorage no esta disponible, no hay nada adicional por limpiar.
   }
 }
 
}
