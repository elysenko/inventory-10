import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Guards are deliberately single-hop: each returns either `true` or ONE UrlTree, and
 * the targets they redirect to (`/login`, `/items`) never bounce back. A guard↔shell
 * redirect loop pins the main thread and renders a permanently blank page.
 *
 * In the preview build a cold load of an authenticated route renders that route: the
 * reviewer's session is seeded in place rather than being redirected to `/login`.
 * `/login` itself is public and always renders, so it stays reviewable.
 */

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (COLOSSUS_PREVIEW) {
    auth.ensurePreviewSession();
    return true;
  }

  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** MANAGER or ADMIN. A USER hitting a manager route is sent to the catalogue. */
export const managerGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (COLOSSUS_PREVIEW) {
    auth.ensurePreviewSession();
    return true;
  }

  if (auth.isManager()) return true;
  return router.createUrlTree(['/items']);
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (COLOSSUS_PREVIEW) {
    auth.ensurePreviewSession();
    return true;
  }

  if (auth.isAdmin()) return true;
  return router.createUrlTree(['/items']);
};
