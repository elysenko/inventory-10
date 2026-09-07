import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { SettingEntry } from '../../core/models';
import { SettingsApi } from '../../shared/api/settings-api.service';
import { apiMessage } from '../../shared/api/api-client.service';

interface ServiceGroup {
  service: string;
  label: string;
  blurb: string;
  entries: SettingEntry[];
}

@Component({
  selector: 'app-settings',
  imports: [FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  private readonly settingsApi = inject(SettingsApi);

  /**
   * Credential keys for each backing service, from `GET /api/admin/settings`. Values
   * arrive masked — the API never returns a stored secret — and saving goes through
   * `PATCH /api/admin/settings`.
   */
  readonly settings = signal<SettingEntry[]>([]);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal<string | null>(null);

  /** Local edits, keyed by setting key. Empty means "leave the stored value alone". */
  readonly drafts = signal<Record<string, string>>({});

  readonly groups = computed<ServiceGroup[]>(() => {
    const meta: Record<string, { label: string; blurb: string }> = {
      postgresql: {
        label: 'PostgreSQL',
        blurb: 'Relational database holding the catalogue, balances and audit history.',
      },
      minio: {
        label: 'MinIO',
        blurb: 'S3-compatible object storage for attachments and exported reports.',
      },
    };

    const services = [...new Set(this.settings().map((entry) => entry.service))];
    return services.map((service) => ({
      service,
      label: meta[service]?.label ?? service,
      blurb: meta[service]?.blurb ?? '',
      entries: this.settings().filter((entry) => entry.service === service),
    }));
  });

  /** The banner appears only while the API still reports unconfigured keys. */
  readonly unconfigured = computed(() => this.settings().filter((entry) => !entry.configured));

  readonly unconfiguredServices = computed(() => [
    ...new Set(this.unconfigured().map((entry) => entry.service)),
  ]);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.settings.set(await this.settingsApi.listSettings());
    } catch (error) {
      this.error.set(apiMessage(error, 'Could not load the service credentials.'));
    } finally {
      this.loading.set(false);
    }
  }

  isConfigured(group: ServiceGroup): boolean {
    return group.entries.every((entry) => entry.configured);
  }

  draftFor(key: string): string {
    return this.drafts()[key] ?? '';
  }

  onDraftChange(key: string, value: string): void {
    this.drafts.update((drafts) => ({ ...drafts, [key]: value }));
    this.saved.set(false);
  }

  /** Sends only this service's non-empty drafts; the API upserts and re-masks them. */
  async save(service: string): Promise<void> {
    this.error.set(null);
    this.saved.set(false);

    const drafts = this.drafts();
    const payload: Record<string, string> = {};
    for (const entry of this.settings()) {
      if (entry.service !== service) continue;
      const draft = drafts[entry.key]?.trim();
      if (draft) payload[entry.key] = draft;
    }

    if (Object.keys(payload).length === 0) {
      this.error.set('Enter at least one value before saving.');
      return;
    }

    this.saving.set(true);
    try {
      this.settings.set(await this.settingsApi.updateSettings(payload));
      // Clear the drafts for this service; stored values are only ever shown masked.
      this.drafts.update((all) => {
        const next = { ...all };
        for (const key of Object.keys(payload)) delete next[key];
        return next;
      });
      this.saved.set(true);
    } catch (error) {
      this.error.set(apiMessage(error, 'Could not save these credentials. Try again.'));
    } finally {
      this.saving.set(false);
    }
  }
}
