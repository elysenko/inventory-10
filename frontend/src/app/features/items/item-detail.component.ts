import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { formatDate } from '../../core/format';
import type { ItemDetail, Movement } from '../../core/models';
import { ItemsApi } from '../../shared/api/items-api.service';
import { MovementsApi } from '../../shared/api/movements-api.service';
import { apiMessage, apiStatus } from '../../shared/api/api-client.service';

type Tab = 'locations' | 'movements';

/** Enough history for one SKU's panel without paging the whole ledger into the page. */
const MOVEMENT_LIMIT = 50;

@Component({
  selector: 'app-item-detail',
  imports: [RouterLink],
  templateUrl: './item-detail.component.html',
  styleUrl: './item-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly itemsApi = inject(ItemsApi);
  private readonly movementsApi = inject(MovementsApi);
  readonly auth = inject(AuthService);

  /** Bound from the `:id` route param by withComponentInputBinding(). */
  readonly id = input<string>('');

  /** The record from `GET /api/items/:id`, including its per-location breakdown. */
  readonly item = signal<ItemDetail | null>(null);

  /** History for the `?tab=movements` panel (`GET /api/movements?itemId=`). */
  readonly movements = signal<Movement[]>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });

  /** The open tab is a URL concern, so a reviewer can be linked straight to either panel. */
  readonly tab = computed<Tab>(() => (this.params().get('tab') === 'movements' ? 'movements' : 'locations'));

  readonly itemMovements = computed(() => this.movements());

  /** Footer total, computed from the breakdown so it always reconciles with the rows. */
  readonly levelsTotal = computed(() =>
    (this.item()?.levels ?? []).reduce((sum, level) => sum + level.qty, 0),
  );

  readonly shortfall = computed(() => {
    const item = this.item();
    return item ? Math.max(0, item.reorderAt - item.totalQty) : 0;
  });

  readonly shortDate = formatDate;

  constructor() {
    // Reloads whenever the route input changes, so navigating item → item refetches.
    effect((onCleanup) => {
      const id = this.id();
      let stale = false;
      onCleanup(() => {
        stale = true;
      });
      void this.load(id, () => stale);
    });
  }

  private async load(id: string, isStale: () => boolean): Promise<void> {
    if (!id) {
      this.item.set(null);
      this.movements.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const detail = await this.itemsApi.getItem(id);
      if (isStale()) return;
      this.item.set(detail);
    } catch (error) {
      if (isStale()) return;
      this.item.set(null);
      // A 404 is "no such item", which the template already renders as its own state.
      if (apiStatus(error) !== 404) {
        this.error.set(apiMessage(error, 'Could not load this item. Try again.'));
      }
    } finally {
      if (!isStale()) this.loading.set(false);
    }

    await this.loadMovements(id, isStale);
  }

  /** The ledger is manager-only; a clerk simply sees the empty movements panel. */
  private async loadMovements(id: string, isStale: () => boolean): Promise<void> {
    if (!this.auth.isManager()) {
      this.movements.set([]);
      return;
    }
    try {
      const page = await this.movementsApi.listMovements({ itemId: id, pageSize: MOVEMENT_LIMIT });
      if (!isStale()) this.movements.set(page.data);
    } catch {
      // History is supplementary — a failure here must not blank out the item itself.
      if (!isStale()) this.movements.set([]);
    }
  }

  selectTab(tab: Tab): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }
}
