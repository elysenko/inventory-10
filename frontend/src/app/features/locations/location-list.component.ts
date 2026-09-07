import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import type { Location } from '../../core/models';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-location-list',
  imports: [RouterLink, ConfirmDialogComponent],
  templateUrl: './location-list.component.html',
  styleUrl: './location-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  /** Storage locations; the service_agent swaps this for `GET /api/locations`. */
  readonly locations = signal<Location[]>([
    { id: 'loc-a', name: 'Zone A', zone: 'Receiving', itemCount: 6, totalQty: 679 },
    { id: 'loc-b', name: 'Zone B', zone: 'Bulk storage', itemCount: 7, totalQty: 1214 },
    { id: 'loc-c', name: 'Zone C', zone: 'Dispatch', itemCount: 5, totalQty: 260 },
  ]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly deleteBlocked = signal<string | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });

  readonly pendingDelete = computed(() => {
    if (this.params().get('modal') !== 'confirm-delete') return null;
    const id = this.params().get('id');
    return id ? (this.locations().find((location) => location.id === id) ?? null) : null;
  });

  readonly totalUnits = computed(() =>
    this.locations().reduce((sum, location) => sum + location.totalQty, 0),
  );

  private merge(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  askDelete(location: Location): void {
    this.deleteBlocked.set(null);
    this.merge({ modal: 'confirm-delete', id: location.id });
  }

  closeDelete(): void {
    this.deleteBlocked.set(null);
    this.merge({ modal: null, id: null });
  }

  /** The API returns 409 while the location still holds stock; surface that, don't delete. */
  confirmDelete(): void {
    const location = this.pendingDelete();
    if (!location) return;

    if (location.totalQty > 0) {
      this.deleteBlocked.set(
        `${location.name} still holds ${location.totalQty} units across ${location.itemCount} items. Transfer them elsewhere before deleting it.`,
      );
      return;
    }

    this.locations.update((all) => all.filter((candidate) => candidate.id !== location.id));
    this.closeDelete();
  }
}
