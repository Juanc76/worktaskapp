import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, from, throwError, BehaviorSubject, } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { MsalService } from '@azure/msal-angular';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

    constructor(
    private msalService: MsalService,
    private authService: AuthService) {}
    private isRefreshing = false;
    private readonly backendUrls = Object.values(environment.apiUrls);
    private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getAccessTokenMemory();
    const activeAccount = this.msalService.instance.getActiveAccount();
    
   
     const isBackendRequest = this.backendUrls.some(apiUrl =>req.url.startsWith(apiUrl));

   
    if (!isBackendRequest) {
      return next.handle(req);
    }

   return next.handle(this.addToken(req, token)).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
            return this.handle401Error(req, next);
        }
        return throwError(() => error);
      })
    ); 
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler) {
  if (!this.isRefreshing) {
    this.isRefreshing = true;
    this.refreshTokenSubject.next(null);

   
    return from(this.authService.refreshToken()).pipe(
      switchMap((response: any) => {
        this.isRefreshing = false;
        this.refreshTokenSubject.next(response.token); 
        return next.handle(this.addToken(request, response.token));
      }),
      catchError((err) => {
        this.isRefreshing = false;
        this.authService.logout(); 
        return throwError(() => err);
      })
    );
  } else {

    // Si ya se está refrescando, esperamos a que el primer refresco termine
    return this.refreshTokenSubject.pipe(
      filter(token => token !== null),
      take(1),
      switchMap((token) => next.handle(this.addToken(request, token)))
    );
  }
  }

  private addToken(request: HttpRequest<any>, token: string | null) {
    if (!token) return request;
  return request.clone({
    setHeaders: {
      Authorization: token ? `Bearer ${token}` : ''
    }
  });
}
}