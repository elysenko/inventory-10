import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import type { LowStockRow } from '../../core/models';

@Component({
  selector: 'app-low-stock',
  imports: [RouterLink],
  templateUrl: './low-stock.component.html',
  styleUrl: './low-stock.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LowStockComponent {
  readonly auth = inject(AuthService);

  /**
   * Items where `SUM(qty) <= reorderAt`, ordered by shortfall descending. The
   * service_agent swaps this for `GET /api/reports/low-stock`. SKU-5002 has no stock
   * rows at all and is correctly included at zero; SKU-2011 sits exactly on its
   * threshold, which the `<=` predicate includes.
   */
  readonly rows = signal<LowStockRow[]>([
    { itemId: 'itm-4001', sku: 'SKU-4001', name: 'Thermal Label, 4x6in', unit: 'roll (250)', onHand: 18, reorderAt: 50, shortfall: 32 },
    { itemId: 'itm-5002', sku: 'SKU-5002', name: 'Pallet Wrap, Clear 500mm', unit: 'roll', onHand: 0, reorderAt: 15, shortfall: 15 },
    { itemId: 'itm-1043', sku: 'SKU-1043', name: 'M8 Hex Nut, Zinc Plated', unit: 'box (100)', onHand: 36, reorderAt: 40, shortfall: 4 },
    { itemId: 'itm-2011', sku: 'SKU-2011', name: 'Nitrile Glove, Large', unit: 'box (50)', onHand: 25, reorderAt: 25, shortfall: 0 },
  ]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly outOfStock = computed(() => this.rows().filter((row) => row.onHand === 0).length);
  readonly totalShortfall = computed(() =>
    this.rows().reduce((sum, row) => sum + row.shortfall, 0),
  );
}
