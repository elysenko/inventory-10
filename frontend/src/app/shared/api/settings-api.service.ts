import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api-client.service';
import type { SettingEntry } from '../../core/models';

/**
 * `/api/admin/settings` — admin-only credential overrides for the backing services
 * (PostgreSQL, MinIO). Values are always returned masked; a blank submitted value
 * means "leave the stored secret alone".
 */
@Injectable({ providedIn: 'root' })
export class SettingsApi {
  private readonly api = inject(ApiClient);

  listSettings(): Promise<SettingEntry[]> {
    return this.api.get<SettingEntry[]>('/admin/settings');
  }

  updateSettings(values: Record<string, string>): Promise<SettingEntry[]> {
    return this.api.patch<SettingEntry[]>('/admin/settings', values);
  }
}
