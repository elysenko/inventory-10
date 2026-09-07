import { Routes } from '@angular/router';
import { adminGuard, authGuard, managerGuard } from './core/guards';

/**
 * Every navigable state is addressable and deep-linkable — opening any path below as a
 * fresh page load renders that screen. Transient states that carry content are given a
 * URL too: item detail tabs via `?tab=`, deletion confirmation via `?modal=confirm-delete&id=`.
 */
export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · StockRoom',
    data: { flow: 'auth.login', chrome: false },
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'signup',
    title: 'Create account · StockRoom',
    data: { flow: 'auth.signup', chrome: false },
    loadComponent: () => import('./features/auth/signup.component').then((m) => m.SignupComponent),
  },

  {
    path: 'items',
    canActivate: [authGuard],
    title: 'Items · StockRoom',
    data: { flow: 'items.list' },
    loadComponent: () =>
      import('./features/items/item-list.component').then((m) => m.ItemListComponent),
  },
  {
    path: 'items/new',
    canActivate: [authGuard, managerGuard],
    title: 'New item · StockRoom',
    data: { flow: 'items.create' },
    loadComponent: () =>
      import('./features/items/item-form.component').then((m) => m.ItemFormComponent),
  },
  {
    path: 'items/:id/edit',
    canActivate: [authGuard, managerGuard],
    title: 'Edit item · StockRoom',
    data: { flow: 'items.edit' },
    loadComponent: () =>
      import('./features/items/item-form.component').then((m) => m.ItemFormComponent),
  },
  {
    path: 'items/:id',
    canActivate: [authGuard],
    title: 'Item · StockRoom',
    data: { flow: 'items.detail' },
    loadComponent: () =>
      import('./features/items/item-detail.component').then((m) => m.ItemDetailComponent),
  },

  {
    path: 'locations',
    canActivate: [authGuard],
    title: 'Locations · StockRoom',
    data: { flow: 'locations.list' },
    loadComponent: () =>
      import('./features/locations/location-list.component').then((m) => m.LocationListComponent),
  },
  {
    path: 'locations/new',
    canActivate: [authGuard, managerGuard],
    title: 'New location · StockRoom',
    data: { flow: 'locations.create' },
    loadComponent: () =>
      import('./features/locations/location-form.component').then((m) => m.LocationFormComponent),
  },
  {
    path: 'locations/:id/edit',
    canActivate: [authGuard, managerGuard],
    title: 'Edit location · StockRoom',
    data: { flow: 'locations.edit' },
    loadComponent: () =>
      import('./features/locations/location-form.component').then((m) => m.LocationFormComponent),
  },

  {
    path: 'movements/new',
    canActivate: [authGuard],
    title: 'Record movement · StockRoom',
    data: { flow: 'movements.create' },
    loadComponent: () =>
      import('./features/movements/movement-form.component').then((m) => m.MovementFormComponent),
  },
  {
    path: 'movements',
    canActivate: [authGuard, managerGuard],
    title: 'Audit log · StockRoom',
    data: { flow: 'movements.log' },
    loadComponent: () =>
      import('./features/movements/movement-log.component').then((m) => m.MovementLogComponent),
  },

  {
    path: 'reports/low-stock',
    canActivate: [authGuard, managerGuard],
    title: 'Low stock · StockRoom',
    data: { flow: 'reports.lowStock' },
    loadComponent: () =>
      import('./features/reports/low-stock.component').then((m) => m.LowStockComponent),
  },

  {
    path: 'admin/settings',
    canActivate: [authGuard, adminGuard],
    title: 'Settings · StockRoom',
    data: { flow: 'admin.settings' },
    loadComponent: () =>
      import('./features/admin/settings.component').then((m) => m.SettingsComponent),
  },

  { path: '', pathMatch: 'full', redirectTo: 'items' },
  { path: '**', redirectTo: 'items' },
];
