import { Injectable, inject } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of, tap, catchError, firstValueFrom } from 'rxjs';
import { AuthenticationResult } from '@azure/msal-browser';
import { LoginRequestDTO, LoginResponseDTO, RefreshRequestDto,LoginMsalRequestDTO,RolJWT, JwtPayload } from '../models/auth.model';
import { Preferences } from '@capacitor/preferences';
import { PermisosStateService } from '../services/permisos-state.service';

@Injectable({
  providedIn: 'root'
})

export class AuthService {

  private msalService = inject(MsalService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private _accessToken: string | null = null;
  private _refreshToken: string | null = null;
 
  private readonly baseUrl3 = environment.authUrl.endpoint3;
  private apiUrl1 = this.baseUrl3+'/login'; 
  private apiUrl2 = this.baseUrl3+'/login-msal';
  private apiUrl3 = this.baseUrl3+'/refresh'; 
  private apiUrl4 = this.baseUrl3+'/logout'; 
  private currentUserSubject = new BehaviorSubject<any>(null);

  loginRequest: LoginRequestDTO | null = null;
  loginResponse: LoginResponseDTO | null = null;
  loginMsalRequest: LoginMsalRequestDTO | null = null;
  refreshRequest: RefreshRequestDto | null = null;
  

 constructor(private permisosState: PermisosStateService) {
   void this.loadTokenFromStorage();
 }

  // ─── JWT helpers ────────────────────────────────────────────────

  /** Decodifica el payload del JWT sin verificar firma */
  decodeToken(token?: string): JwtPayload | null {
    const t = token ?? this.getAccessTokenMemory();
    return this.decodeJwtPayload(t);
  }

  async decodeCurrentToken(): Promise<JwtPayload | null> {
    let token = this.getAccessTokenMemory();

    if (!token) {
      token = await this.getAccessTokenStorage();
      this.setAccessTokenMemory(token);
    }

    return this.decodeJwtPayload(token);
  }

  /** Devuelve los roles del JWT actual */
  getRolesFromToken(): RolJWT[] {
    return this.decodeToken()?.roles ?? [];
  }

  getUserId(): number | null {
    return this.extractUserId(this.decodeToken());
  }

  async getCurrentUserId(): Promise<number | null> {
    return this.extractUserId(await this.decodeCurrentToken());
  }

  getUserName(): string | null {
    return this.extractUserName(this.decodeToken());
  }

  async getCurrentUserName(): Promise<string | null> {
    return this.extractUserName(await this.decodeCurrentToken());
  }

  /** Carga permisos para un rol específico */
  cargarPermisosPorRol(idRol: number): Observable<any> {
    return this.permisosState.cargarPermisosPorRol(idRol);
  }

  // ─── Login local ─────────────────────────────────────────────────

  async login(login: string, password: string): Promise<LoginResponseDTO> {
        
    this.loginRequest = {
      username: login,
      password: password,
    };
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Client-Platform': 'mobile'
    });

    const response = await firstValueFrom(
      this.http.post<LoginResponseDTO>(this.apiUrl1, this.loginRequest, { headers }).pipe(
        catchError(this.handleError)
      )
    );

    if (!response.token) {
      throw new Error('El servidor no devolvio un token de acceso');
    }

    await this.saveTokens(response.token, response.refreshToken);
    this.loginResponse = response;
    return response;
  }


// ─── Refresh token ───────────────────────────────────────────────
async refreshToken(): Promise<LoginResponseDTO> {
// El servicio nativo de tracking puede rotar el refresh token mientras el
// WebView está suspendido. Storage es la fuente vigente; memoria es fallback.
const currentRefreshToken = await this.getRefreshTokenStorage() ?? this.getRefreshTokenMemory();
  if (!currentRefreshToken) {
    throw new Error('No hay refresh token disponible');
  }
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Client-Platform': 'mobile'
    });
   const body: RefreshRequestDto = { refreshToken: currentRefreshToken };
   const response = await firstValueFrom(
     this.http.post<LoginResponseDTO>(`${this.apiUrl3}`, body, { headers }).pipe(
       catchError(this.handleError)
     )
   );

   if (!response.token) {
     throw new Error('El servidor no devolvio un token de acceso');
   }

   await this.saveTokens(response.token, response.refreshToken);
   this.loginResponse = response;
   return response;
}


// ─── Token storage ───────────────────────────────────────────────
  async loadTokenFromStorage() {
   const token = await this.getAccessTokenStorage();
   const refresh = await this.getRefreshTokenStorage();
   this._accessToken = token || null;
   this._refreshToken = refresh || null;
  }

 async saveTokens(accessToken: string, refreshToken?: string) {
      if (accessToken) {  
      this.setAccessTokenMemory(accessToken);
      await this.setAccessTokenStorage(accessToken);
      }
    if (refreshToken) {
      this.setRefreshTokenMemory(refreshToken);
      await this.setRefreshTokenStorage(refreshToken);
    }
  }

 
 async getAccessTokenStorage(): Promise<string | null> {
    const { value: token } = await Preferences.get({ key: 'token' });
    return token || null; 
  }
  
   async getRefreshTokenStorage(): Promise<string | null> {
    const { value: token } = await Preferences.get({ key: 'refreshtoken' });
    return token || null; 
  }
  
 async setAccessTokenStorage(accessToken: string): Promise<void> {
  await Preferences.set({ key: 'token', value: accessToken });
  }

  async setRefreshTokenStorage(refreshToken: string): Promise<void> {
  await Preferences.set({ key: 'refreshtoken', value: refreshToken });
  }

  setAccessTokenMemory(token: string | null): void {
    this._accessToken = token;
  }

  setRefreshTokenMemory(token: string | null): void {
    this._refreshToken = token;
  }

  getAccessTokenMemory(): string | null {
    return this._accessToken;
  }

  getRefreshTokenMemory(): string | null {
    return this._refreshToken;
  }


// ─── Logout ──────────────────────────────────────────────────────
  logout(): void {
    this._accessToken = null;
    this._refreshToken = null;
    this.currentUserSubject.next(null); 
    void Preferences.remove({ key: 'token' });
    void Preferences.remove({ key: 'refreshtoken' });
    localStorage.removeItem('idRolActivo');
    this.permisosState.limpiar();
     

     const headers = new HttpHeaders({
      'X-Client-Platform': 'mobile'
      });

     this.http.post(`${this.apiUrl4}`, {}, { headers })
       .pipe(
            tap(() => {
             
            }),
            catchError(err => {
              return of(null);
            })
       ).subscribe(() => {
     
      this.router.navigate(['/auth/login']);
    });
   }

  
 
  private handleError = (error: HttpErrorResponse): Observable<never> => {
   
    let message = 'Error desconocido';
    if (error.status === 0) message = 'No se puede conectar al servidor';
    else if (error.status === 401) message = 'Usuario o contraseña incorrectos';
    else if (error.error) message = error.error;
    return throwError(() => new Error(message));
  };

  private decodeJwtPayload(token: string | null | undefined): JwtPayload | null {
    try {
      if (!token) return null;

      const payload = token.split('.')[1];
      if (!payload) return null;

      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const paddedBase64 = base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '=');
       return JSON.parse(atob(paddedBase64)) as JwtPayload;
    } catch {
      return null;
    }
  }

  private extractUserId(payload: JwtPayload | null): number | null {
    const value = payload?.uid ?? payload?.idUser ?? payload?.idUsuario ?? payload?.sub;
    const id = Number(value);

    return Number.isFinite(id) ? id : null;
  }

  private extractUserName(payload: JwtPayload | null): string | null {
    const value = payload?.nombrePersona ?? payload?.name ?? payload?.unique_name ?? null;

    if (!value) return null;

    const nombre = String(value).trim();
    return nombre || null;
  }
}
