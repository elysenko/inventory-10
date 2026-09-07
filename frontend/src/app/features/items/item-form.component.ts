import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { Item } from '../../core/models';

/** SKUs already in the catalogue — stands in for the API's `P2002` duplicate check. */
const TAKEN_SKUS = ['SKU-1042', 'SKU-1043', 'SKU-2011', 'SKU-2012', 'SKU-3007', 'SKU-3008', 'SKU-4001', 'SKU-5002'];

@Component({
  selector: 'app-item-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './item-form.component.html',
  styleUrl: './item-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  /** Present on `/items/:id/edit`, absent on `/items/new` — this is what picks the mode. */
  readonly id = input<string>('');

  /** Source catalogue; the service_agent swaps this for `GET /api/items/:id`. */
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

  readonly form = this.fb.nonNullable.group({
    sku: ['', [Validators.required]],
    name: ['', [Validators.required]],
    description: [''],
    unit: ['each', [Validators.required]],
    reorderAt: [0, [Validators.required, Validators.min(0)]],
  });

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  /** Field-level error mapped from the API's duplicate-SKU 409. */
  readonly skuError = signal<string | null>(null);

  readonly isEdit = computed(() => this.id().length > 0);
  readonly existing = computed(() => this.items().find((item) => item.id === this.id()) ?? null);

  constructor() {
    // Populate the form once the route input resolves to a known item.
    effect(() => {
      const item = this.existing();
      if (!item) return;
      this.form.patchValue({
        sku: item.sku,
        name: item.name,
        description: item.description ?? '',
        unit: item.unit,
        reorderAt: item.reorderAt,
      });
    });
  }

  async submit(): Promise<void> {
    this.error.set(null);
    this.skuError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Fill in the SKU, name and unit, and set a reorder point of zero or more.');
      return;
    }

    const value = this.form.getRawValue();
    const sku = value.sku.trim().toUpperCase();

    // Mirrors the API: a duplicate SKU is refused and no second row is created.
    const clash = this.items().find((item) => item.sku === sku && item.id !== this.id());
    if (clash || (!this.isEdit() && TAKEN_SKUS.includes(sku))) {
      this.skuError.set(`${sku} is already used by another item. Choose a different SKU.`);
      return;
    }

    this.saving.set(true);
    await this.router.navigate(['/items']);
    this.saving.set(false);
  }

  cancel(): void {
    void this.router.navigate(['/items']);
  }
}
