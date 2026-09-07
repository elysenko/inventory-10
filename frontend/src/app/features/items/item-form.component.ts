import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { Item } from '../../core/models';
import { ItemsApi } from '../../shared/api/items-api.service';
import { apiField, apiMessage, apiStatus } from '../../shared/api/api-client.service';

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
  private readonly itemsApi = inject(ItemsApi);

  /** Present on `/items/:id/edit`, absent on `/items/new` — this is what picks the mode. */
  readonly id = input<string>('');

  /** The record being edited, loaded from `GET /api/items/:id`. Null on create. */
  readonly existing = signal<Item | null>(null);

  readonly form = this.fb.nonNullable.group({
    sku: ['', [Validators.required]],
    name: ['', [Validators.required]],
    description: [''],
    unit: ['each', [Validators.required]],
    reorderAt: [0, [Validators.required, Validators.min(0)]],
  });

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  /** Field-level error mapped from the API's duplicate-SKU 409. */
  readonly skuError = signal<string | null>(null);

  readonly isEdit = computed(() => this.id().length > 0);

  constructor() {
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
      this.existing.set(null);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      const item = await this.itemsApi.getItem(id);
      if (isStale()) return;
      this.existing.set(item);
      this.form.patchValue({
        sku: item.sku,
        name: item.name,
        description: item.description ?? '',
        unit: item.unit,
        reorderAt: item.reorderAt,
      });
    } catch (error) {
      if (isStale()) return;
      this.existing.set(null);
      // 404 is rendered by the template's "no catalogue entry matches" state.
      if (apiStatus(error) !== 404) {
        this.error.set(apiMessage(error, 'Could not load this item. Try again.'));
      }
    } finally {
      if (!isStale()) this.loading.set(false);
    }
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
    const payload = {
      sku: value.sku.trim(),
      name: value.name.trim(),
      description: value.description.trim(),
      unit: value.unit.trim(),
      reorderAt: Number(value.reorderAt),
    };

    this.saving.set(true);
    try {
      if (this.isEdit()) {
        await this.itemsApi.updateItem(this.id(), payload);
      } else {
        await this.itemsApi.createItem(payload);
      }
      await this.router.navigate(['/items']);
    } catch (error) {
      // A duplicate SKU comes back as 409 with `field: 'sku'`; it becomes a field-level
      // message so the form stays filled in, and no second row is ever created.
      const message = apiMessage(error, 'Could not save this item. Check the details and try again.');
      if (apiStatus(error) === 409 || apiField(error) === 'sku') {
        this.skuError.set(message);
      } else {
        this.error.set(message);
      }
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/items']);
  }
}
