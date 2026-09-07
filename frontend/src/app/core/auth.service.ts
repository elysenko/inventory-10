import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type { AuthResponse, Role, User } from './models';
import { STORAGE_KEYS, readStorage, removeStorage, writeStorage } from './storage';

const EMAIL_RE = /^[^\s@]+@[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

/** The signed-in identity the preview seeds. ADMIN so every role-gated screen is reviewable. */
const PREVIEW_USER: User = {
  id: 'usr-preview-admin',
  email: 'dana.okafor@stockroom.example',
  name: 'Dana Okafor',
  role: 'ADMIN',
  createdAt: '2026-01-08T09:12:00.000Z',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(null);
  readonly user = signal<User | null>(null);

  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isManager = computed(() => {
    const role = this.user()?.role;
    return role === 'MANAGER' || role === 'ADMIN';
  });
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

  constructor() {
    this.restore();
  }

  /**
   * Rehydrate from storage. Everything read here is untrusted: a stale or malformed
   * value must never throw, because a throw during bootstrap blanks the whole page.
   * On any unrecognized shape we clear those keys and continue signed-out.
   */
  private restore(): void {
    try {
      const raw = readStorage(STORAGE_KEYS.user);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!this.isValidUser(parsed)) {
        removeStorage(STORAGE_KEYS.user, STORAGE_KEYS.token);
        return;
      }
      this.user.set(parsed);
      this.token.set(readStorage(STORAGE_KEYS.token));
    } catch {
      removeStorage(STORAGE_KEYS.user, STORAGE_KEYS.token);
    }
  }

  private isValidUser(value: unknown): value is User {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as Record<string, unknown>;
    const roles: Role[] = ['USER', 'MANAGER', 'ADMIN'];
    return (
      typeof candidate['id'] === 'string' &&
      typeof candidate['email'] === 'string' &&
      typeof candidate['role'] === 'string' &&
      roles.includes(candidate['role'] as Role)
    );
  }

  private persist(user: User, token: string): void {
    this.user.set(user);
    this.token.set(token);
    writeStorage(STORAGE_KEYS.user, JSON.stringify(user));
    writeStorage(STORAGE_KEYS.token, token);
  }

  /**
   * Sign in.
   *
   * In the preview build this resolves locally and synchronously — the preview host
   * serves static files with no API behind them, so an awaited network call would
   * strand the reviewer on this screen. In the production build the same method is
   * the real `POST /api/auth/login`.
   */
  async login(email: string, password: string): Promise<string | null> {
    if (COLOSSUS_PREVIEW) {
      const problem = this.validateCredentials(email, password);
      if (problem) return problem;
      this.persist({ ...PREVIEW_USER, email: email.trim() }, 'preview-session-token');
      await this.router.navigate(['/items']);
      return null;
    }

    try {
      const res = await firstValueFrom(
        this.http.post<AuthResponse>('/api/auth/login', { email, password }),
      );
      this.persist(res.user, res.accessToken);
      await this.router.navigate(['/items']);
      return null;
    } catch {
      return 'Invalid email or password.';
    }
  }

  /** Register. Mirrors `login()`: local in preview, `POST /api/auth/signup` in production. */
  async signup(email: string, password: string, name: string): Promise<string | null> {
    if (COLOSSUS_PREVIEW) {
      const problem = this.validateCredentials(email, password);
      if (problem) return problem;
      this.persist(
        { ...PREVIEW_USER, email: email.trim(), name: name.trim() || null },
        'preview-session-token',
      );
      await this.router.navigate(['/items']);
      return null;
    }

    try {
      const res = await firstValueFrom(
        this.http.post<AuthResponse>('/api/auth/signup', { email, password, name }),
      );
      this.persist(res.user, res.accessToken);
      await this.router.navigate(['/items']);
      return null;
    } catch {
      return 'That email is already registered.';
    }
  }

  /** Shape-only check. Anything well-formed succeeds; only empty/malformed input fails. */
  private validateCredentials(email: string, password: string): string | null {
    if (!email.trim() || !password) return 'Enter your email and password to continue.';
    if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address.';
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    return null;
  }

  /**
   * Preview-only: seed the signed-in state with no credentials at all and land on the
   * authenticated home. Backs the visible "Skip login" shortcut and the guards' cold-load
   * path, so a reviewer (or the screenshot capture) can reach every authenticated screen.
   */
  previewSignIn(): void {
    if (!COLOSSUS_PREVIEW) return;
    this.persist(PREVIEW_USER, 'preview-session-token');
  }

  /** Guarantees an authenticated session exists in preview without redirecting. */
  ensurePreviewSession(): void {
    if (!COLOSSUS_PREVIEW) return;
    if (!this.user()) this.previewSignIn();
  }

  logout(): void {
    this.user.set(null);
    this.token.set(null);
    removeStorage(STORAGE_KEYS.user, STORAGE_KEYS.token);
    void this.router.navigate(['/login']);
  }
}
