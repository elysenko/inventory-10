import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

/**
 * Thin HttpClient wrapper shared by every `*-api.service.ts`.
 *
 * Every call goes to the NestJS API under `/api` — same-origin in production (nginx
 * proxies `/api/` to the backend container) and proxied by `proxy.conf.json` in dev.
 * Requests are exposed as promises so components can `await` them inside `ngOnInit`.
 */

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

/** Global prefix set by `app.setGlobalPrefix('api')` in the backend's main.ts. */
export const API_BASE = '/api';

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  /** Empty, null and undefined values are dropped so `?q=` never reaches the API. */
  private toParams(query?: QueryParams): HttpParams {
    let params = new HttpParams();
    if (!query) return params;
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined || value === '') continue;
      params = params.set(key, String(value));
    }
    return params;
  }

  get<T>(path: string, query?: QueryParams): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${API_BASE}${path}`, { params: this.toParams(query) }));
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${API_BASE}${path}`, body));
  }

  patch<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.patch<T>(`${API_BASE}${path}`, body));
  }

  delete(path: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`${API_BASE}${path}`)).then(() => undefined);
  }
}

/** HTTP status of a failed call, or `null` when the failure was not an HTTP response. */
export function apiStatus(error: unknown): number | null {
  return error instanceof HttpErrorResponse ? error.status : null;
}

/**
 * The API's own message, so a rejection reads exactly as the server explained it
 * ("Insufficient stock at Zone A: 5 on hand, 10 requested."). Falls back to the
 * caller's copy for network failures and unexpected shapes.
 */
export function apiMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;

  if (error.status === 0) {
    return 'Cannot reach the StockRoom API right now. Check your connection and try again.';
  }

  const body: unknown = error.error;
  if (typeof body === 'string' && body.trim()) return body.trim();

  if (body && typeof body === 'object') {
    const message = (body as { message?: unknown }).message;
    if (Array.isArray(message)) {
      const parts = message.filter((part): part is string => typeof part === 'string');
      if (parts.length) return parts.join(' ');
    }
    if (typeof message === 'string' && message.trim()) return message.trim();
  }

  return fallback;
}

/** Field name a 409/400 blamed, when the API returned one (e.g. duplicate `sku`). */
export function apiField(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body: unknown = error.error;
  if (body && typeof body === 'object') {
    const field = (body as { field?: unknown }).field;
    if (typeof field === 'string') return field;
  }
  return null;
}
