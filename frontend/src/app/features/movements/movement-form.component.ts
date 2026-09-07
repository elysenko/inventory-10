import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import type { ItemDetail, Location, MovementType } from '../../core/models';

const TYPES: { value: MovementType; label: string; hint: string }[] = [
  { value: 'IN', label: 'Stock in', hint: 'Receive units into a location.' },
  { value: 'OUT', label: 'Stock out', hint: 'Issue units out of a location.' },
  { value: 'TRANSFER', label: 'Transfer', hint: 'Move units between two locations.' },
];

@Component({
  selector: 'app-movement-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './movement-form.component.html',
  styleUrl: './movement-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovementFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly types = TYPES;

  /** Catalogue with per-location balances; the service_agent swaps this for `GET /api/items`. */
  readonly items = signal<ItemDetail[]>([
    { id: 'itm-1042', sku: 'SKU-1042', name: 'M8 Hex Bolt, Zinc Plated', description: null, unit: 'box (100)', reorderAt: 40, totalQty: 128, lowStock: false, levels: [ { locationId: 'loc-a', locationName: 'Zone A', zone: 'Receiving', qty: 64 }, { locationId: 'loc-b', locationName: 'Zone B', zone: 'Bulk storage', qty: 52 }, { locationId: 'loc-c', locationName: 'Zone C', zone: 'Dispatch', qty: 12 } ] },
    { id: 'itm-1043', sku: 'SKU-1043', name: 'M8 Hex Nut, Zinc Plated', description: null, unit: 'box (100)', reorderAt: 40, totalQty: 36, lowStock: true, levels: [ { locationId: 'loc-a', locationName: 'Zone A', zone: 'Receiving', qty: 20 }, { locationId: 'loc-b', locationName: 'Zone B', zone: 'Bulk storage', qty: 16 }, { locationId: 'loc-c', locationName: 'Zone C', zone: 'Dispatch', qty: 0 } ] },
    { id: 'itm-2011', sku: 'SKU-2011', name: 'Nitrile Glove, Large', description: null, unit: 'box (50)', reorderAt: 25, totalQty: 25, lowStock: true, levels: [ { locationId: 'loc-a', locationName: 'Zone A', zone: 'Receiving', qty: 5 }, { locationId: 'loc-b', locationName: 'Zone B', zone: 'Bulk storage', qty: 20 }, { locationId: 'loc-c', locationName: 'Zone C', zone: 'Dispatch', qty: 0 } ] },
    { id: 'itm-2012', sku: 'SKU-2012', name: 'Safety Goggles, Clear', description: null, unit: 'each', reorderAt: 30, totalQty: 214, lowStock: false, levels: [ { locationId: 'loc-a', locationName: 'Zone A', zone: 'Receiving', qty: 90 }, { locationId: 'loc-b', locationName: 'Zone B', zone: 'Bulk storage', qty: 100 }, { locationId: 'loc-c', locationName: 'Zone C', zone: 'Dispatch', qty: 24 } ] },
    { id: 'itm-3007', sku: 'SKU-3007', name: 'Packing Tape, 48mm Clear', description: null, unit: 'roll', reorderAt: 60, totalQty: 412, lowStock: false, levels: [ { locationId: 'loc-a', locationName: 'Zone A', zone: 'Receiving', qty: 120 }, { locationId: 'loc-b', locationName: 'Zone B', zone: 'Bulk storage', qty: 220 }, { locationId: 'loc-c', locationName: 'Zone C', zone: 'Dispatch', qty: 72 } ] },
    { id: 'itm-3008', sku: 'SKU-3008', name: 'Corrugated Box, Medium', description: null, unit: 'each', reorderAt: 200, totalQty: 1340, lowStock: false, levels: [ { locationId: 'loc-a', locationName: 'Zone A', zone: 'Receiving', qty: 400 }, { locationId: 'loc-b', locationName: 'Zone B', zone: 'Bulk storage', qty: 800 }, { locationId: 'loc-c', locationName: 'Zone C', zone: 'Dispatch', qty: 140 } ] },
    { id: 'itm-4001', sku: 'SKU-4001', name: 'Thermal Label, 4x6in', description: null, unit: 'roll (250)', reorderAt: 50, totalQty: 18, lowStock: true, levels: [ { locationId: 'loc-a', locationName: 'Zone A', zone: 'Receiving', qty: 0 }, { locationId: 'loc-b', locationName: 'Zone B', zone: 'Bulk storage', qty: 6 }, { locationId: 'loc-c', locationName: 'Zone C', zone: 'Dispatch', qty: 12 } ] },
    { id: 'itm-5002', sku: 'SKU-5002', name: 'Pallet Wrap, Clear 500mm', description: null, unit: 'roll', reorderAt: 15, totalQty: 0, lowStock: true, levels: [ { locationId: 'loc-a', locationName: 'Zone A', zone: 'Receiving', qty: 0 }, { locationId: 'loc-b', locationName: 'Zone B', zone: 'Bulk storage', qty: 0 }, { locationId: 'loc-c', locationName: 'Zone C', zone: 'Dispatch', qty: 0 } ] },
  ]);

  /** Location select options; the service_agent swaps this for `GET /api/locations`. */
  readonly locations = signal<Location[]>([
    { id: 'loc-a', name: 'Zone A', zone: 'Receiving', itemCount: 6, totalQty: 679 },
    { id: 'loc-b', name: 'Zone B', zone: 'Bulk storage', itemCount: 7, totalQty: 1214 },
    { id: 'loc-c', name: 'Zone C', zone: 'Dispatch', itemCount: 5, totalQty: 260 },
  ]);

  readonly form = this.fb.nonNullable.group({
    type: ['IN' as MovementType, [Validators.required]],
    itemId: ['', [Validators.required]],
    fromLocId: [''],
    toLocId: [''],
    qty: [1, [Validators.required, Validators.min(1)]],
    note: [''],
  });

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  /** Item typeahead state. */
  readonly itemSearch = signal('');
  readonly pickerOpen = signal(false);

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });
  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  readonly type = computed(() => (this.formValue().type ?? 'IN') as MovementType);
  readonly needsSource = computed(() => this.type() === 'OUT' || this.type() === 'TRANSFER');
  readonly needsDestination = computed(() => this.type() === 'IN' || this.type() === 'TRANSFER');

  readonly selectedItem = computed(
    () => this.items().find((item) => item.id === this.formValue().itemId) ?? null,
  );

  readonly matchingItems = computed(() => {
    const term = this.itemSearch().trim().toLowerCase();
    const all = this.items();
    if (!term) return all.slice(0, 6);
    return all
      .filter((item) => item.sku.toLowerCase().includes(term) || item.name.toLowerCase().includes(term))
      .slice(0, 6);
  });

  /** Balance at the chosen source — what the server checks before allowing OUT/TRANSFER. */
  readonly availableAtSource = computed(() => {
    const item = this.selectedItem();
    const fromLocId = this.formValue().fromLocId;
    if (!item || !fromLocId) return null;
    return item.levels.find((level) => level.locationId === fromLocId)?.qty ?? 0;
  });

  constructor() {
    // Deep links prefill the form: /movements/new?type=IN&itemId=…&fromLocId=…
    effect(() => {
      const params = this.params();
      const type = params.get('type');
      const itemId = params.get('itemId');
      const fromLocId = params.get('fromLocId');

      if (type === 'IN' || type === 'OUT' || type === 'TRANSFER') {
        this.form.patchValue({ type }, { emitEvent: false });
      }
      if (itemId && this.items().some((item) => item.id === itemId)) {
        this.form.patchValue({ itemId }, { emitEvent: false });
      }
      if (fromLocId && this.locations().some((location) => location.id === fromLocId)) {
        this.form.patchValue({ fromLocId }, { emitEvent: false });
      }
      this.form.updateValueAndValidity();
    });
  }

  selectType(type: MovementType): void {
    // Clearing the now-irrelevant endpoint mirrors the DTO: IN forbids a source,
    // OUT forbids a destination.
    this.form.patchValue({
      type,
      fromLocId: type === 'IN' ? '' : this.form.getRawValue().fromLocId,
      toLocId: type === 'OUT' ? '' : this.form.getRawValue().toLocId,
    });
    this.error.set(null);
  }

  chooseItem(itemId: string): void {
    this.form.patchValue({ itemId });
    this.pickerOpen.set(false);
    this.itemSearch.set('');
  }

  onSearch(value: string): void {
    this.itemSearch.set(value);
    this.pickerOpen.set(true);
  }

  /**
   * Client-side mirror of the server's DTO rules and stock check. A rejection leaves the
   * form exactly as the user filled it — nothing is cleared — so the entry can be fixed.
   */
  submit(): void {
    this.error.set(null);
    this.success.set(null);

    const value = this.form.getRawValue();

    if (!value.itemId) {
      this.error.set('Choose an item to move.');
      return;
    }
    if (value.qty < 1) {
      this.error.set('Quantity must be at least 1.');
      return;
    }
    if (this.needsSource() && !value.fromLocId) {
      this.error.set(`A ${value.type} movement needs a source location.`);
      return;
    }
    if (this.needsDestination() && !value.toLocId) {
      this.error.set(`A ${value.type} movement needs a destination location.`);
      return;
    }
    if (value.type === 'TRANSFER' && value.fromLocId === value.toLocId) {
      this.error.set('Source and destination must be different locations.');
      return;
    }

    const available = this.availableAtSource();
    if (this.needsSource() && available !== null && value.qty > available) {
      const item = this.selectedItem();
      this.error.set(
        `Insufficient stock: ${item?.sku} has ${available} ${item?.unit} at the source location, but ${value.qty} were requested. The balance is unchanged.`,
      );
      return;
    }

    this.submitting.set(true);
    const item = this.selectedItem();
    this.success.set(
      `Recorded ${value.type} of ${value.qty} × ${item?.sku}. Balances updated.`,
    );
    this.submitting.set(false);
  }

  viewLog(): void {
    void this.router.navigate(['/movements']);
  }

  reset(): void {
    this.form.reset({ type: this.type(), itemId: '', fromLocId: '', toLocId: '', qty: 1, note: '' });
    this.success.set(null);
    this.error.set(null);
  }
}
