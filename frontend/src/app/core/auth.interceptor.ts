import { Injector, inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { STORAGE_KEYS, readStorage } from './storage';
import { AuthService } from './auth.service';

/** Login and signup legitimately answer 401/409 — those must not clear the session. */
const CREDENTIAL_ENDPOINTS = ['/api/auth/login', '/api/auth/signup'];

/**
 * Attaches the bearer token to every `/api` call and turns a 401 into a single,
 * clean sign-out.
 *
 * The token is read from storage rather than from `AuthService` so this interceptor
 * has no construction-time dependency on the service that itself depends on
 * HttpClient. `AuthService` is resolved lazily, and only on the 401 path.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const injector = inject(Injector);
  const isApiCall = req.url.startsWith('/api');
  const isCredentialCall = CREDENTIAL_ENDPOINTS.some((path) => req.url.startsWith(path));
  const token = isApiCall ? readStorage(STORAGE_KEYS.token) : null;

  const authorized =
    token && !req.headers.has('Authorization')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && isApiCall && !isCredentialCall) {
        injector.get(AuthService).sessionExpired();
      }
      return throwError(() => error);
    }),
  );
};
