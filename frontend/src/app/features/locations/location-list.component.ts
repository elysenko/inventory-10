import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import type { Location } from '../../core/models';
import { LocationsApi } from '../../shared/api/locations-api.service';
import { apiMessage } from '../../shared/api/api-client.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-location-list',
  imports: [RouterLink, ConfirmDialogComponent],
  templateUrl: './location-list.component.html',
  styleUrl: './location-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly locationsApi = inject(LocationsApi);
  readonly auth = inject(AuthService);

  /** Storage locations from `GET /api/locations`, with their live occupancy. */
  readonly locations = signal<Location[]>([]);

  readonly loading = signal(true);
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

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.locations.set(await this.locationsApi.listLocations());
    } catch (error) {
      this.error.set(apiMessage(error, 'Could not load the locations. Try again.'));
    } finally {
      this.loading.set(false);
    }
  }

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
  async confirmDelete(): Promise<void> {
    const location = this.pendingDelete();
    if (!location) return;

    this.deleteBlocked.set(null);
    try {
      await this.locationsApi.deleteLocation(location.id);
      await this.load();
      this.closeDelete();
    } catch (error) {
      this.deleteBlocked.set(
        apiMessage(
          error,
          `${location.name} could not be deleted. Transfer its stock elsewhere and try again.`,
        ),
      );
    }
  }
}
