import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import type { Item } from '../../core/models';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-item-list',
  imports: [RouterLink, ConfirmDialogComponent],
  templateUrl: './item-list.component.html',
  styleUrl: './item-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemListComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  /**
   * Catalogue rows. The service_agent replaces this initializer with `[]` and loads it
   * from `GET /api/items` in ngOnInit; `totalQty`/`lowStock` are computed server-side.
   */
  readonly items = signal<Item[]>([
    { id: 'itm-1042', sku: 'SKU-1042', name: 'M8 Hex Bolt, Zinc Plated', description: 'Grade 8.8 structural bolt, 40mm shank.', unit: 'box (100)', reorderAt: 40, totalQty: 128, lowStock: false },
    { id: 'itm-1043', sku: 'SKU-1043', name: 'M8 Hex Nut, Zinc Plated', description: 'Matching nut for SKU-1042.', unit: 'box (100)', reorderAt: 40, totalQty: 36, lowStock: true },
    { id: 'itm-2011', sku: 'SKU-2011', name: 'Nitrile Glove, Large', description: 'Powder-free, blue, 5 mil.', unit: 'box (50)', reorderAt: 25, totalQty: 25, lowStock: true },
    { id: 'itm-2012', sku: 'SKU-2012', name: 'Safety Goggles, Clear', description: 'Anti-fog polycarbonate, ANSI Z87.1.', unit: 'each', reorderAt: 30, totalQty: 214, lowStock: false },
    { id: 'itm-3007', sku: 'SKU-3007', name: 'Packing Tape, 48mm Clear', description: 'Acrylic adhesive, 66m roll.', unit: 'roll', reorderAt: 60, totalQty: 412, lowStock: false },
    { id: 'itm-3008', sku: 'SKU-3008', name: 'Corrugated Box, Medium', description: '400 x 300 x 250mm, single wall.', unit: 'each', reorderAt: 200, totalQty: 1340, lowStock: false },
    { id: 'itm-4001', sku: 'SKU-4001', name: 'Thermal Label, 4x6in', description: 'Direct thermal shipping label.', unit: 'roll (250)', reorderAt: 50, totalQty: 18, lowStock: true },
    { id: 'itm-5002', sku: 'SKU-5002', name: 'Pallet Wrap, Clear 500mm', description: 'Hand-grade stretch film, 23 micron.', unit: 'roll', reorderAt: 15, totalQty: 0, lowStock: true },
  ]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Populated from the API's 409 when a delete is refused. */
  readonly deleteBlocked = signal<string | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });

  readonly query = computed(() => this.params().get('q') ?? '');
  readonly lowOnly = computed(() => this.params().get('low') === 'true');

  readonly pendingDeleteId = computed(() =>
    this.params().get('modal') === 'confirm-delete' ? this.params().get('id') : null,
  );

  readonly pendingDelete = computed(() => {
    const id = this.pendingDeleteId();
    return id ? (this.items().find((item) => item.id === id) ?? null) : null;
  });

  readonly visibleItems = computed(() => {
    const term = this.query().trim().toLowerCase();
    return this.items().filter((item) => {
      if (this.lowOnly() && !item.lowStock) return false;
      if (!term) return true;
      return item.sku.toLowerCase().includes(term) || item.name.toLowerCase().includes(term);
    });
  });

  readonly lowCount = computed(() => this.items().filter((item) => item.lowStock).length);

  /** Filters live in the URL so a filtered catalogue view is shareable and bookmarkable. */
  private merge(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  onSearch(value: string): void {
    this.merge({ q: value.trim() || null });
  }

  toggleLowOnly(): void {
    this.merge({ low: this.lowOnly() ? null : 'true' });
  }

  clearFilters(): void {
    this.merge({ q: null, low: null });
  }

  askDelete(item: Item): void {
    this.deleteBlocked.set(null);
    this.merge({ modal: 'confirm-delete', id: item.id });
  }

  closeDelete(): void {
    this.deleteBlocked.set(null);
    this.merge({ modal: null, id: null });
  }

  /**
   * The API refuses (409) when the item still holds stock or is referenced by movements,
   * so the dialog surfaces that reason instead of removing the row.
   */
  confirmDelete(): void {
    const item = this.pendingDelete();
    if (!item) return;

    if (item.totalQty > 0) {
      this.deleteBlocked.set(
        `${item.sku} still holds ${item.totalQty} ${item.unit} across its locations. Move the stock out before deleting it.`,
      );
      return;
    }

    this.items.update((items) => items.filter((candidate) => candidate.id !== item.id));
    this.closeDelete();
  }
}
