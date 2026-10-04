import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SelectProvidersResponse } from '../models/catalogo.models';

@Injectable({
  providedIn: 'root'
})



export class CatalogService {
   private baseUrl1 = environment.authUrl.endpoint3;
   private baseUrl2 = environment.apiUrls.endpoint2;
   private apiUrl1 = this.baseUrl1+'/getCatalogos';
   private apiUrl2 = this.baseUrl2+'/getCatalogos';



  constructor(private http: HttpClient) {}

  getCatalogs(names: string[]) {
    return this.http.get<SelectProvidersResponse>(
      `${this.apiUrl1}`,
      {
        params: { names: names.join(',') }
      }
    );
  }

  getCatalogsB(names: string[]) {
    return this.http.get<SelectProvidersResponse>(
      `${this.apiUrl2}`,
      {
        params: { names: names.join(',') }
      }
    );
  }

}
