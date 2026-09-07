import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { Location } from '../../core/models';

@Component({
  selector: 'app-location-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './location-form.component.html',
  styleUrl: './location-form.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocationFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  /** Present on `/locations/:id/edit`, absent on `/locations/new`. */
  readonly id = input<string>('');

  /** Source list; the service_agent swaps this for `GET /api/locations`. */
  readonly locations = signal<Location[]>([
    { id: 'loc-a', name: 'Zone A', zone: 'Receiving', itemCount: 6, totalQty: 679 },
    { id: 'loc-b', name: 'Zone B', zone: 'Bulk storage', itemCount: 7, totalQty: 1214 },
    { id: 'loc-c', name: 'Zone C', zone: 'Dispatch', itemCount: 5, totalQty: 260 },
  ]);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    zone: ['', [Validators.required]],
  });

  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  /** Field-level error mapped from the API's duplicate-name 409. */
  readonly nameError = signal<string | null>(null);

  readonly isEdit = computed(() => this.id().length > 0);
  readonly existing = computed(() => this.locations().find((loc) => loc.id === this.id()) ?? null);

  constructor() {
    effect(() => {
      const location = this.existing();
      if (!location) return;
      this.form.patchValue({ name: location.name, zone: location.zone });
    });
  }

  async submit(): Promise<void> {
    this.error.set(null);
    this.nameError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Give the location a name and a zone.');
      return;
    }

    const { name } = this.form.getRawValue();
    const clash = this.locations().find(
      (loc) => loc.name.toLowerCase() === name.trim().toLowerCase() && loc.id !== this.id(),
    );
    if (clash) {
      this.nameError.set(`A location named "${clash.name}" already exists. Choose a different name.`);
      return;
    }

    this.saving.set(true);
    await this.router.navigate(['/locations']);
    this.saving.set(false);
  }

  cancel(): void {
    void this.router.navigate(['/locations']);
  }
}
