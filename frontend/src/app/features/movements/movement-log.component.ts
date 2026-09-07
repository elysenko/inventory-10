import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { formatDateTime } from '../../core/format';
import type { Item, Movement, MovementType } from '../../core/models';
import { ItemsApi } from '../../shared/api/items-api.service';
import { MovementsApi } from '../../shared/api/movements-api.service';
import { apiMessage } from '../../shared/api/api-client.service';

const PAGE_SIZE = 8;

@Component({
  selector: 'app-movement-log',
  imports: [RouterLink],
  templateUrl: './movement-log.component.html',
  styleUrl: './movement-log.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementLogComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly itemsApi = inject(ItemsApi);
  private readonly movementsApi = inject(MovementsApi);

  readonly pageSize = PAGE_SIZE;
  readonly types: MovementType[] = ['IN', 'OUT', 'TRANSFER'];
  readonly when = formatDateTime;

  /** Filter dropdown options (`GET /api/items`). */
  readonly items = signal<Item[]>([]);

  /** The current page of `GET /api/movements` — filtering and paging happen server-side. */
  readonly pageRows = signal<Movement[]>([]);
  readonly total = signal(0);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });

  readonly itemFilter = computed(() => this.params().get('itemId') ?? '');
  readonly typeFilter = computed(() => this.params().get('type') ?? '');
  readonly fromFilter = computed(() => this.params().get('from') ?? '');
  readonly toFilter = computed(() => this.params().get('to') ?? '');
  readonly page = computed(() => Math.max(1, Number(this.params().get('page') ?? '1') || 1));

  readonly hasFilters = computed(
    () => !!(this.itemFilter() || this.typeFilter() || this.fromFilter() || this.toFilter()),
  );

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  readonly rangeStart = computed(() => (this.total() ? (this.page() - 1) * PAGE_SIZE + 1 : 0));
  readonly rangeEnd = computed(() =>
    Math.min((this.page() - 1) * PAGE_SIZE + this.pageRows().length, this.total()),
  );

  constructor() {
    // Every filter and the page number live in the URL, so one effect over the query
    // params is the whole data-loading trigger — and any filtered view is shareable.
    effect((onCleanup) => {
      const query = {
        itemId: this.itemFilter(),
        type: this.typeFilter(),
        from: this.fromFilter(),
        to: this.toFilter(),
        page: this.page(),
      };
      let stale = false;
      onCleanup(() => {
        stale = true;
      });
      void this.load(query, () => stale);
    });
  }

  ngOnInit(): void {
    void this.loadItems();
  }

  private async loadItems(): Promise<void> {
    try {
      this.items.set(await this.itemsApi.listItems());
    } catch {
      // The filter dropdown is optional chrome; the log itself still renders.
      this.items.set([]);
    }
  }

  private async load(
    query: { itemId: string; type: string; from: string; to: string; page: number },
    isStale: () => boolean,
  ): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const result = await this.movementsApi.listMovements({
        itemId: query.itemId || undefined,
        type: query.type || undefined,
        from: query.from || undefined,
        to: query.to || undefined,
        page: query.page,
        pageSize: PAGE_SIZE,
      });
      if (isStale()) return;
      this.pageRows.set(result.data);
      this.total.set(result.total);
    } catch (error) {
      if (isStale()) return;
      this.pageRows.set([]);
      this.total.set(0);
      this.error.set(apiMessage(error, 'Could not load the audit log. Try again.'));
    } finally {
      if (!isStale()) this.loading.set(false);
    }
  }

  private merge(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  /** Any filter change resets to page 1 — otherwise a narrowed result set lands out of range. */
  setFilter(key: 'itemId' | 'type' | 'from' | 'to', value: string): void {
    this.merge({ [key]: value || null, page: null });
  }

  clearFilters(): void {
    this.merge({ itemId: null, type: null, from: null, to: null, page: null });
  }

  goToPage(page: number): void {
    const target = Math.min(Math.max(1, page), this.pageCount());
    this.merge({ page: target === 1 ? null : String(target) });
  }
}
