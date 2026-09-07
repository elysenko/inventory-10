import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { SettingEntry } from '../../core/models';

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
export class SettingsComponent {
  /**
   * Credential keys for each backing service. Values arrive masked from
   * `GET /api/admin/settings`; the service_agent swaps this initializer for that call
   * and wires the save button to `PATCH /api/admin/settings`.
   */
  readonly settings = signal<SettingEntry[]>([
    { key: 'DATABASE_URL', service: 'postgresql', label: 'Connection URL', value: 'postgresql://stockroom:••••••••@app-db:5432/stockroom', configured: true, hint: 'Primary datastore for items, locations, balances and movements.' },
    { key: 'MINIO_ENDPOINT', service: 'minio', label: 'Endpoint', value: '', configured: false, hint: 'Host and port of the object store, e.g. minio:9000.' },
    { key: 'MINIO_ACCESS_KEY', service: 'minio', label: 'Access key', value: '', configured: false, hint: 'Access key issued by the object store.' },
    { key: 'MINIO_SECRET_KEY', service: 'minio', label: 'Secret key', value: '', configured: false, hint: 'Stored encrypted; only ever returned masked.' },
    { key: 'MINIO_BUCKET', service: 'minio', label: 'Bucket', value: '', configured: false, hint: 'Bucket that receives uploaded documents.' },
  ]);

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

  save(service: string): void {
    this.error.set(null);
    this.saving.set(true);

    const drafts = this.drafts();
    this.settings.update((entries) =>
      entries.map((entry) => {
        if (entry.service !== service) return entry;
        const draft = drafts[entry.key]?.trim();
        if (!draft) return entry;
        return { ...entry, value: maskValue(draft), configured: true };
      }),
    );

    // Clear the drafts for this service; stored values are only ever shown masked.
    this.drafts.update((all) => {
      const next = { ...all };
      for (const entry of this.settings()) {
        if (entry.service === service) delete next[entry.key];
      }
      return next;
    });

    this.saving.set(false);
    this.saved.set(true);
  }
}

/** Mirrors the API's masking: keep a readable prefix, hide the rest. */
function maskValue(value: string): string {
  if (value.length <= 4) return '••••';
  return `${value.slice(0, 4)}${'•'.repeat(Math.min(12, value.length - 4))}`;
}
