import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import type { Item, Location, MovementType, StockLevelView } from '../../core/models';
import { ItemsApi } from '../../shared/api/items-api.service';
import { LocationsApi } from '../../shared/api/locations-api.service';
import { MovementsApi } from '../../shared/api/movements-api.service';
import { apiMessage } from '../../shared/api/api-client.service';

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
export class MovementFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly itemsApi = inject(ItemsApi);
  private readonly locationsApi = inject(LocationsApi);
  private readonly movementsApi = inject(MovementsApi);

  readonly types = TYPES;

  /** Catalogue for the typeahead (`GET /api/items`). */
  readonly items = signal<Item[]>([]);

  /** Location select options (`GET /api/locations`). */
  readonly locations = signal<Location[]>([]);

  /** Per-location balances for the chosen item, from `GET /api/items/:id`. */
  private readonly levels = signal<StockLevelView[]>([]);

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
    const fromLocId = this.formValue().fromLocId;
    if (!this.selectedItem() || !fromLocId) return null;
    return this.levels().find((level) => level.locationId === fromLocId)?.qty ?? 0;
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

    // Whenever the chosen item changes, pull its per-location balances so the
    // "N available here" hint reflects the stored balance rather than a guess.
    effect((onCleanup) => {
      const itemId = this.formValue().itemId ?? '';
      let stale = false;
      onCleanup(() => {
        stale = true;
      });
      void this.loadLevels(itemId, () => stale);
    });
  }

  ngOnInit(): void {
    void this.loadOptions();
  }

  private async loadOptions(): Promise<void> {
    try {
      const [items, locations] = await Promise.all([
        this.itemsApi.listItems(),
        this.locationsApi.listLocations(),
      ]);
      this.items.set(items);
      this.locations.set(locations);
    } catch (error) {
      this.error.set(apiMessage(error, 'Could not load items and locations. Try again.'));
    }
  }

  private async loadLevels(itemId: string, isStale: () => boolean): Promise<void> {
    if (!itemId) {
      this.levels.set([]);
      return;
    }
    try {
      const detail = await this.itemsApi.getItem(itemId);
      if (!isStale()) this.levels.set(detail.levels);
    } catch {
      // The hint is advisory; the server remains the authority on available stock.
      if (!isStale()) this.levels.set([]);
    }
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
   * Shape checks mirror the server DTO so an obviously invalid entry never leaves the
   * browser; the stock check itself is the server's, made inside its transaction. A
   * rejection leaves the form exactly as the user filled it — nothing is cleared.
   */
  async submit(): Promise<void> {
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

    const item = this.selectedItem();
    this.submitting.set(true);
    try {
      const movement = await this.movementsApi.createMovement({
        type: value.type,
        itemId: value.itemId,
        ...(this.needsSource() ? { fromLocId: value.fromLocId } : {}),
        ...(this.needsDestination() ? { toLocId: value.toLocId } : {}),
        qty: Number(value.qty),
        ...(value.note.trim() ? { note: value.note.trim() } : {}),
      });

      this.success.set(
        `Recorded ${movement.type} of ${movement.qty} × ${movement.itemSku}. Balances updated.`,
      );
      // Refresh the balances the form advertises, and the on-hand totals in the picker.
      await Promise.all([this.loadLevels(value.itemId, () => false), this.loadOptions()]);
    } catch (error) {
      // 400 carries the server's insufficient-stock message; the balance is unchanged.
      this.error.set(
        apiMessage(error, `Could not record this movement for ${item?.sku ?? 'the item'}.`),
      );
    } finally {
      this.submitting.set(false);
    }
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
