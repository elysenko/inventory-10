import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api-client.service';
import type { Location } from '../../core/models';

export interface CreateLocationPayload {
  name: string;
  zone: string;
}

export type UpdateLocationPayload = Partial<CreateLocationPayload>;

/** `/api/locations` — readable by everyone (the movement form's selects), writable by managers. */
@Injectable({ providedIn: 'root' })
export class LocationsApi {
  private readonly api = inject(ApiClient);

  listLocations(): Promise<Location[]> {
    return this.api.get<Location[]>('/locations');
  }

  getLocation(id: string): Promise<Location> {
    return this.api.get<Location>(`/locations/${encodeURIComponent(id)}`);
  }

  createLocation(payload: CreateLocationPayload): Promise<Location> {
    return this.api.post<Location>('/locations', payload);
  }

  updateLocation(id: string, payload: UpdateLocationPayload): Promise<Location> {
    return this.api.patch<Location>(`/locations/${encodeURIComponent(id)}`, payload);
  }

  /** 409 while the location still holds stock or is referenced by movements. */
  deleteLocation(id: string): Promise<void> {
    return this.api.delete(`/locations/${encodeURIComponent(id)}`);
  }
}
