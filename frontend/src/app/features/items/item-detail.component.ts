import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { formatDate } from '../../core/format';
import type { ItemDetail, Movement } from '../../core/models';

type Tab = 'locations' | 'movements';

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
  readonly auth = inject(AuthService);

  /** Bound from the `:id` route param by withComponentInputBinding(). */
  readonly id = input<string>('');

  /**
   * Catalogue with per-location breakdowns. The service_agent replaces this initializer
   * with `[]` and loads the single record from `GET /api/items/:id` in ngOnInit.
   */
  readonly details = signal<ItemDetail[]>([
    { id: 'itm-1042', sku: 'SKU-1042', name: 'M8 Hex Bolt, Zinc Plated', description: 'Grade 8.8 structural bolt, 40mm shank.', unit: 'box (100)', reorderAt: 40, totalQty: 128, lowStock: false, levels: [ { locationId: 'loc-a', locationName: 'Zone A', zone: 'Receiving', qty: 64 }, { locationId: 'loc-b', locationName: 'Zone B', zone: 'Bulk storage', qty: 52 }, { locationId: 'loc-c', locationName: 'Zone C', zone: 'Dispatch', qty: 12 } ] },
    { id: 'itm-1043', sku: 'SKU-1043', name: 'M8 Hex Nut, Zinc Plated', description: 'Matching nut for SKU-1042.', unit: 'box (100)', reorderAt: 40, totalQty: 36, lowStock: true, levels: [ { locationId: 'loc-a', locationName: 'Zone A', zone: 'Receiving', qty: 20 }, { locationId: 'loc-b', locationName: 'Zone B', zone: 'Bulk storage', qty: 16 }, { locationId: 'loc-c', locationName: 'Zone C', zone: 'Dispatch', qty: 0 } ] },
    { id: 'itm-2011', sku: 'SKU-2011', name: 'Nitrile Glove, Large', description: 'Powder-free, blue, 5 mil.', unit: 'box (50)', reorderAt: 25, totalQty: 25, lowStock: true, levels: [ { locationId: 'loc-a', locationName: 'Zone A', zone: 'Receiving', qty: 5 }, { locationId: 'loc-b', locationName: 'Zone B', zone: 'Bulk storage', qty: 20 }, { locationId: 'loc-c', locationName: 'Zone C', zone: 'Dispatch', qty: 0 } ] },
    { id: 'itm-2012', sku: 'SKU-2012', name: 'Safety Goggles, Clear', description: 'Anti-fog polycarbonate, ANSI Z87.1.', unit: 'each', reorderAt: 30, totalQty: 214, lowStock: false, levels: [ { locationId: 'loc-a', locationName: 'Zone A', zone: 'Receiving', qty: 90 }, { locationId: 'loc-b', locationName: 'Zone B', zone: 'Bulk storage', qty: 100 }, { locationId: 'loc-c', locationName: 'Zone C', zone: 'Dispatch', qty: 24 } ] },
    { id: 'itm-3007', sku: 'SKU-3007', name: 'Packing Tape, 48mm Clear', description: 'Acrylic adhesive, 66m roll.', unit: 'roll', reorderAt: 60, totalQty: 412, lowStock: false, levels: [ { locationId: 'loc-a', locationName: 'Zone A', zone: 'Receiving', qty: 120 }, { locationId: 'loc-b', locationName: 'Zone B', zone: 'Bulk storage', qty: 220 }, { locationId: 'loc-c', locationName: 'Zone C', zone: 'Dispatch', qty: 72 } ] },
    { id: 'itm-3008', sku: 'SKU-3008', name: 'Corrugated Box, Medium', description: '400 x 300 x 250mm, single wall.', unit: 'each', reorderAt: 200, totalQty: 1340, lowStock: false, levels: [ { locationId: 'loc-a', locationName: 'Zone A', zone: 'Receiving', qty: 400 }, { locationId: 'loc-b', locationName: 'Zone B', zone: 'Bulk storage', qty: 800 }, { locationId: 'loc-c', locationName: 'Zone C', zone: 'Dispatch', qty: 140 } ] },
    { id: 'itm-4001', sku: 'SKU-4001', name: 'Thermal Label, 4x6in', description: 'Direct thermal shipping label.', unit: 'roll (250)', reorderAt: 50, totalQty: 18, lowStock: true, levels: [ { locationId: 'loc-a', locationName: 'Zone A', zone: 'Receiving', qty: 0 }, { locationId: 'loc-b', locationName: 'Zone B', zone: 'Bulk storage', qty: 6 }, { locationId: 'loc-c', locationName: 'Zone C', zone: 'Dispatch', qty: 12 } ] },
    { id: 'itm-5002', sku: 'SKU-5002', name: 'Pallet Wrap, Clear 500mm', description: 'Hand-grade stretch film, 23 micron.', unit: 'roll', reorderAt: 15, totalQty: 0, lowStock: true, levels: [ { locationId: 'loc-a', locationName: 'Zone A', zone: 'Receiving', qty: 0 }, { locationId: 'loc-b', locationName: 'Zone B', zone: 'Bulk storage', qty: 0 }, { locationId: 'loc-c', locationName: 'Zone C', zone: 'Dispatch', qty: 0 } ] },
  ]);

  /** Movement history for the `?tab=movements` panel (`GET /api/movements?itemId=`). */
  readonly movements = signal<Movement[]>([
    { id: 'mv-8801', type: 'TRANSFER', itemId: 'itm-1042', itemSku: 'SKU-1042', itemName: 'M8 Hex Bolt, Zinc Plated', fromLocId: 'loc-b', fromLocName: 'Zone B', toLocId: 'loc-c', toLocName: 'Zone C', qty: 12, note: 'Staged for order #4471', userEmail: 'priya.nair@stockroom.example', userRole: 'USER', createdAt: '2026-09-05T14:22:00.000Z' },
    { id: 'mv-8794', type: 'IN', itemId: 'itm-1042', itemSku: 'SKU-1042', itemName: 'M8 Hex Bolt, Zinc Plated', fromLocId: null, fromLocName: null, toLocId: 'loc-a', toLocName: 'Zone A', qty: 40, note: 'PO-2291 delivery', userEmail: 'sam.becker@stockroom.example', userRole: 'MANAGER', createdAt: '2026-09-04T09:05:00.000Z' },
    { id: 'mv-8770', type: 'OUT', itemId: 'itm-1043', itemSku: 'SKU-1043', itemName: 'M8 Hex Nut, Zinc Plated', fromLocId: 'loc-b', fromLocName: 'Zone B', toLocId: null, toLocName: null, qty: 14, note: 'Line 3 consumption', userEmail: 'priya.nair@stockroom.example', userRole: 'USER', createdAt: '2026-09-03T16:48:00.000Z' },
    { id: 'mv-8752', type: 'OUT', itemId: 'itm-4001', itemSku: 'SKU-4001', itemName: 'Thermal Label, 4x6in', fromLocId: 'loc-c', fromLocName: 'Zone C', toLocId: null, toLocName: null, qty: 22, note: 'Peak dispatch week', userEmail: 'dana.okafor@stockroom.example', userRole: 'ADMIN', createdAt: '2026-09-02T11:30:00.000Z' },
    { id: 'mv-8730', type: 'IN', itemId: 'itm-2011', itemSku: 'SKU-2011', itemName: 'Nitrile Glove, Large', fromLocId: null, fromLocName: null, toLocId: 'loc-b', toLocName: 'Zone B', qty: 20, note: null, userEmail: 'sam.becker@stockroom.example', userRole: 'MANAGER', createdAt: '2026-09-01T08:15:00.000Z' },
  ]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });

  /** The open tab is a URL concern, so a reviewer can be linked straight to either panel. */
  readonly tab = computed<Tab>(() => (this.params().get('tab') === 'movements' ? 'movements' : 'locations'));

  readonly item = computed(() => this.details().find((detail) => detail.id === this.id()) ?? null);

  readonly itemMovements = computed(() =>
    this.movements().filter((movement) => movement.itemId === this.id()),
  );

  /** Footer total, computed from the breakdown so it always reconciles with the rows. */
  readonly levelsTotal = computed(() =>
    (this.item()?.levels ?? []).reduce((sum, level) => sum + level.qty, 0),
  );

  readonly shortfall = computed(() => {
    const item = this.item();
    return item ? Math.max(0, item.reorderAt - item.totalQty) : 0;
  });

  readonly shortDate = formatDate;

  selectTab(tab: Tab): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }
}
