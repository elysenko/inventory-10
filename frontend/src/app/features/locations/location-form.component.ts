import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { Location } from '../../core/models';
import { LocationsApi } from '../../shared/api/locations-api.service';
import { apiField, apiMessage, apiStatus } from '../../shared/api/api-client.service';

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
  private readonly locationsApi = inject(LocationsApi);

  /** Present on `/locations/:id/edit`, absent on `/locations/new`. */
  readonly id = input<string>('');

  /** The record being edited, loaded from `GET /api/locations/:id`. Null on create. */
  readonly existing = signal<Location | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    zone: ['', [Validators.required]],
  });

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  /** Field-level error mapped from the API's duplicate-name 409. */
  readonly nameError = signal<string | null>(null);

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
      const location = await this.locationsApi.getLocation(id);
      if (isStale()) return;
      this.existing.set(location);
      this.form.patchValue({ name: location.name, zone: location.zone });
    } catch (error) {
      if (isStale()) return;
      this.existing.set(null);
      if (apiStatus(error) !== 404) {
        this.error.set(apiMessage(error, 'Could not load this location. Try again.'));
      }
    } finally {
      if (!isStale()) this.loading.set(false);
    }
  }

  async submit(): Promise<void> {
    this.error.set(null);
    this.nameError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Give the location a name and a zone.');
      return;
    }

    const value = this.form.getRawValue();
    const payload = { name: value.name.trim(), zone: value.zone.trim() };

    this.saving.set(true);
    try {
      if (this.isEdit()) {
        await this.locationsApi.updateLocation(this.id(), payload);
      } else {
        await this.locationsApi.createLocation(payload);
      }
      await this.router.navigate(['/locations']);
    } catch (error) {
      const message = apiMessage(
        error,
        'Could not save this location. Check the details and try again.',
      );
      if (apiStatus(error) === 409 || apiField(error) === 'name') {
        this.nameError.set(message);
      } else {
        this.error.set(message);
      }
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/locations']);
  }
}
