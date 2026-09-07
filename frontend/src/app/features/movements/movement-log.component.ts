import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { formatDateTime } from '../../core/format';
import type { Item, Movement, MovementType } from '../../core/models';

const PAGE_SIZE = 8;

@Component({
  selector: 'app-movement-log',
  imports: [RouterLink],
  templateUrl: './movement-log.component.html',
  styleUrl: './movement-log.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementLogComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly pageSize = PAGE_SIZE;
  readonly types: MovementType[] = ['IN', 'OUT', 'TRANSFER'];
  readonly when = formatDateTime;

  /** Filter dropdown options; the service_agent swaps this for `GET /api/items`. */
  readonly items = signal<Item[]>([
    { id: 'itm-1042', sku: 'SKU-1042', name: 'M8 Hex Bolt, Zinc Plated', description: null, unit: 'box (100)', reorderAt: 40, totalQty: 128, lowStock: false },
    { id: 'itm-1043', sku: 'SKU-1043', name: 'M8 Hex Nut, Zinc Plated', description: null, unit: 'box (100)', reorderAt: 40, totalQty: 36, lowStock: true },
    { id: 'itm-2011', sku: 'SKU-2011', name: 'Nitrile Glove, Large', description: null, unit: 'box (50)', reorderAt: 25, totalQty: 25, lowStock: true },
    { id: 'itm-2012', sku: 'SKU-2012', name: 'Safety Goggles, Clear', description: null, unit: 'each', reorderAt: 30, totalQty: 214, lowStock: false },
    { id: 'itm-3007', sku: 'SKU-3007', name: 'Packing Tape, 48mm Clear', description: null, unit: 'roll', reorderAt: 60, totalQty: 412, lowStock: false },
    { id: 'itm-3008', sku: 'SKU-3008', name: 'Corrugated Box, Medium', description: null, unit: 'each', reorderAt: 200, totalQty: 1340, lowStock: false },
    { id: 'itm-4001', sku: 'SKU-4001', name: 'Thermal Label, 4x6in', description: null, unit: 'roll (250)', reorderAt: 50, totalQty: 18, lowStock: true },
    { id: 'itm-5002', sku: 'SKU-5002', name: 'Pallet Wrap, Clear 500mm', description: null, unit: 'roll', reorderAt: 15, totalQty: 0, lowStock: true },
  ]);

  /** Audit rows; the service_agent swaps this for the paginated `GET /api/movements`. */
  readonly movements = signal<Movement[]>([
    { id: 'mv-8801', type: 'TRANSFER', itemId: 'itm-1042', itemSku: 'SKU-1042', itemName: 'M8 Hex Bolt, Zinc Plated', fromLocId: 'loc-b', fromLocName: 'Zone B', toLocId: 'loc-c', toLocName: 'Zone C', qty: 12, note: 'Staged for order #4471', userEmail: 'priya.nair@stockroom.example', userRole: 'USER', createdAt: '2026-09-05T14:22:00.000Z' },
    { id: 'mv-8799', type: 'OUT', itemId: 'itm-3007', itemSku: 'SKU-3007', itemName: 'Packing Tape, 48mm Clear', fromLocId: 'loc-c', fromLocName: 'Zone C', toLocId: null, toLocName: null, qty: 24, note: 'Dispatch consumption', userEmail: 'priya.nair@stockroom.example', userRole: 'USER', createdAt: '2026-09-05T11:04:00.000Z' },
    { id: 'mv-8796', type: 'IN', itemId: 'itm-3008', itemSku: 'SKU-3008', itemName: 'Corrugated Box, Medium', fromLocId: null, fromLocName: null, toLocId: 'loc-b', toLocName: 'Zone B', qty: 400, note: 'PO-2304 pallet delivery', userEmail: 'sam.becker@stockroom.example', userRole: 'MANAGER', createdAt: '2026-09-04T15:41:00.000Z' },
    { id: 'mv-8794', type: 'IN', itemId: 'itm-1042', itemSku: 'SKU-1042', itemName: 'M8 Hex Bolt, Zinc Plated', fromLocId: null, fromLocName: null, toLocId: 'loc-a', toLocName: 'Zone A', qty: 40, note: 'PO-2291 delivery', userEmail: 'sam.becker@stockroom.example', userRole: 'MANAGER', createdAt: '2026-09-04T09:05:00.000Z' },
    { id: 'mv-8788', type: 'TRANSFER', itemId: 'itm-2012', itemSku: 'SKU-2012', itemName: 'Safety Goggles, Clear', fromLocId: 'loc-a', fromLocName: 'Zone A', toLocId: 'loc-c', toLocName: 'Zone C', qty: 24, note: null, userEmail: 'dana.okafor@stockroom.example', userRole: 'ADMIN', createdAt: '2026-09-03T17:20:00.000Z' },
    { id: 'mv-8770', type: 'OUT', itemId: 'itm-1043', itemSku: 'SKU-1043', itemName: 'M8 Hex Nut, Zinc Plated', fromLocId: 'loc-b', fromLocName: 'Zone B', toLocId: null, toLocName: null, qty: 14, note: 'Line 3 consumption', userEmail: 'priya.nair@stockroom.example', userRole: 'USER', createdAt: '2026-09-03T16:48:00.000Z' },
    { id: 'mv-8765', type: 'OUT', itemId: 'itm-2011', itemSku: 'SKU-2011', itemName: 'Nitrile Glove, Large', fromLocId: 'loc-a', fromLocName: 'Zone A', toLocId: null, toLocName: null, qty: 10, note: 'PPE restock, floor 2', userEmail: 'priya.nair@stockroom.example', userRole: 'USER', createdAt: '2026-09-03T08:12:00.000Z' },
    { id: 'mv-8752', type: 'OUT', itemId: 'itm-4001', itemSku: 'SKU-4001', itemName: 'Thermal Label, 4x6in', fromLocId: 'loc-c', fromLocName: 'Zone C', toLocId: null, toLocName: null, qty: 22, note: 'Peak dispatch week', userEmail: 'dana.okafor@stockroom.example', userRole: 'ADMIN', createdAt: '2026-09-02T11:30:00.000Z' },
    { id: 'mv-8744', type: 'TRANSFER', itemId: 'itm-3007', itemSku: 'SKU-3007', itemName: 'Packing Tape, 48mm Clear', fromLocId: 'loc-b', fromLocName: 'Zone B', toLocId: 'loc-c', toLocName: 'Zone C', qty: 48, note: 'Replenish dispatch bench', userEmail: 'sam.becker@stockroom.example', userRole: 'MANAGER', createdAt: '2026-09-02T09:55:00.000Z' },
    { id: 'mv-8730', type: 'IN', itemId: 'itm-2011', itemSku: 'SKU-2011', itemName: 'Nitrile Glove, Large', fromLocId: null, fromLocName: null, toLocId: 'loc-b', toLocName: 'Zone B', qty: 20, note: null, userEmail: 'sam.becker@stockroom.example', userRole: 'MANAGER', createdAt: '2026-09-01T08:15:00.000Z' },
    { id: 'mv-8721', type: 'IN', itemId: 'itm-2012', itemSku: 'SKU-2012', itemName: 'Safety Goggles, Clear', fromLocId: null, fromLocName: null, toLocId: 'loc-a', toLocName: 'Zone A', qty: 120, note: 'PO-2277 delivery', userEmail: 'sam.becker@stockroom.example', userRole: 'MANAGER', createdAt: '2026-08-31T13:02:00.000Z' },
    { id: 'mv-8710', type: 'OUT', itemId: 'itm-3008', itemSku: 'SKU-3008', itemName: 'Corrugated Box, Medium', fromLocId: 'loc-c', fromLocName: 'Zone C', toLocId: null, toLocName: null, qty: 160, note: 'Weekly pack run', userEmail: 'priya.nair@stockroom.example', userRole: 'USER', createdAt: '2026-08-31T10:30:00.000Z' },
  ]);

  readonly loading = signal(false);
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

  /** Every filter is a query param, so any filtered view is a shareable link. */
  readonly filtered = computed(() => {
    const itemId = this.itemFilter();
    const type = this.typeFilter();
    const from = this.fromFilter();
    // `to` is inclusive to end-of-day, matching the API's date handling.
    const to = this.toFilter();

    return this.movements().filter((movement) => {
      if (itemId && movement.itemId !== itemId) return false;
      if (type && movement.type !== type) return false;
      const day = movement.createdAt.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
  });

  readonly total = computed(() => this.filtered().length);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));

  readonly pageRows = computed(() => {
    const start = (Math.min(this.page(), this.pageCount()) - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

  readonly rangeStart = computed(() => (this.total() ? (this.page() - 1) * PAGE_SIZE + 1 : 0));
  readonly rangeEnd = computed(() => Math.min(this.page() * PAGE_SIZE, this.total()));

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
