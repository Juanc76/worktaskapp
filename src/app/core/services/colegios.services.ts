
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Localidad,ColegioDTO } from '../../core/models/colegios.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})

export class ColegioService {
  private baseUrl = environment.apiUrls.endpoint2;
  private apiUrl = this.baseUrl+'/getArbolColegios';
  private apiUrl2 = this.baseUrl+'/getLocalidades';

  constructor(private http: HttpClient) {}

  getColegiosTree(): Observable<Record<number, ColegioDTO[]>> {
    return this.http.get<Record<number, ColegioDTO[]>>(this.apiUrl);
  }

  getLocalidades(): Observable<Localidad[]> {
    return this.http.get<Localidad[]>(this.apiUrl2);
  }

}