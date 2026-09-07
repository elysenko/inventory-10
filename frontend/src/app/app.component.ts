import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from './core/auth.service';

interface NavItem {
  label: string;
  shortLabel: string;
  path: string;
  icon: string;
  /** Minimum role required for the link to appear. */
  access: 'all' | 'manager' | 'admin';
  exact: boolean;
}

/** Tabs beyond this count collapse behind a "More" sheet on mobile. */
const MAX_MOBILE_TABS = 5;

const NAV: NavItem[] = [
  { label: 'Items', shortLabel: 'Items', path: '/items', icon: '▤', access: 'all', exact: false },
  { label: 'Locations', shortLabel: 'Zones', path: '/locations', icon: '⌂', access: 'all', exact: false },
  { label: 'Record movement', shortLabel: 'Record', path: '/movements/new', icon: '⇄', access: 'all', exact: true },
  { label: 'Audit log', shortLabel: 'Log', path: '/movements', icon: '☰', access: 'manager', exact: true },
  { label: 'Low stock', shortLabel: 'Low', path: '/reports/low-stock', icon: '⚑', access: 'manager', exact: true },
  { label: 'Settings', shortLabel: 'Admin', path: '/admin/settings', icon: '⚙', access: 'admin', exact: true },
];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  private readonly url = signal(this.router.url);

  readonly moreOpen = signal(false);

  /** Auth screens render standalone — no sidebar, no tab bar. */
  readonly showChrome = computed(() => {
    const path = this.url().split('?')[0];
    return !path.startsWith('/login') && !path.startsWith('/signup');
  });

  readonly navItems = computed(() =>
    NAV.filter((item) => {
      if (item.access === 'admin') return this.auth.isAdmin();
      if (item.access === 'manager') return this.auth.isManager();
      return true;
    }),
  );

  /** At most MAX_MOBILE_TABS in the bottom bar; the tail moves into the More sheet. */
  readonly mobileTabs = computed(() => {
    const items = this.navItems();
    return items.length <= MAX_MOBILE_TABS ? items : items.slice(0, MAX_MOBILE_TABS - 1);
  });

  readonly overflowTabs = computed(() => {
    const items = this.navItems();
    return items.length <= MAX_MOBILE_TABS ? [] : items.slice(MAX_MOBILE_TABS - 1);
  });

  readonly initials = computed(() => {
    const user = this.auth.user();
    if (!user) return '··';
    const source = user.name?.trim() || user.email;
    const parts = source.split(/[\s.@]+/).filter(Boolean);
    return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '');
  });

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.url.set(event.urlAfterRedirects);
        this.moreOpen.set(false);
      });
  }

  toggleMore(): void {
    this.moreOpen.update((open) => !open);
  }

  logout(): void {
    this.moreOpen.set(false);
    this.auth.logout();
  }
}
