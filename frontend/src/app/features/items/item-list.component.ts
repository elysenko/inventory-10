import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import type { Item } from '../../core/models';
import { ItemsApi } from '../../shared/api/items-api.service';
import { apiMessage } from '../../shared/api/api-client.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-item-list',
  imports: [RouterLink, ConfirmDialogComponent],
  templateUrl: './item-list.component.html',
  styleUrl: './item-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly itemsApi = inject(ItemsApi);
  readonly auth = inject(AuthService);

  /** Catalogue rows from `GET /api/items`; `totalQty`/`lowStock` are computed server-side. */
  readonly items = signal<Item[]>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  /** Populated from the API's 409 when a delete is refused. */
  readonly deleteBlocked = signal<string | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, { requireSync: true });

  readonly query = computed(() => this.params().get('q') ?? '');
  readonly lowOnly = computed(() => this.params().get('low') === 'true');

  readonly pendingDeleteId = computed(() =>
    this.params().get('modal') === 'confirm-delete' ? this.params().get('id') : null,
  );

  readonly pendingDelete = computed(() => {
    const id = this.pendingDeleteId();
    return id ? (this.items().find((item) => item.id === id) ?? null) : null;
  });

  /**
   * Filtering stays client-side over the loaded catalogue: the search box then reacts
   * instantly and typing does not fire a request per keystroke.
   */
  readonly visibleItems = computed(() => {
    const term = this.query().trim().toLowerCase();
    return this.items().filter((item) => {
      if (this.lowOnly() && !item.lowStock) return false;
      if (!term) return true;
      return item.sku.toLowerCase().includes(term) || item.name.toLowerCase().includes(term);
    });
  });

  readonly lowCount = computed(() => this.items().filter((item) => item.lowStock).length);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.items.set(await this.itemsApi.listItems());
    } catch (error) {
      this.error.set(apiMessage(error, 'Could not load the catalogue. Try again.'));
    } finally {
      this.loading.set(false);
    }
  }

  /** Filters live in the URL so a filtered catalogue view is shareable and bookmarkable. */
  private merge(queryParams: Record<string, string | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }

  onSearch(value: string): void {
    this.merge({ q: value.trim() || null });
  }

  toggleLowOnly(): void {
    this.merge({ low: this.lowOnly() ? null : 'true' });
  }

  clearFilters(): void {
    this.merge({ q: null, low: null });
  }

  askDelete(item: Item): void {
    this.deleteBlocked.set(null);
    this.merge({ modal: 'confirm-delete', id: item.id });
  }

  closeDelete(): void {
    this.deleteBlocked.set(null);
    this.merge({ modal: null, id: null });
  }

  /**
   * The API refuses with 409 when the item still holds stock or is referenced by
   * movements; that server message is shown in the dialog and the row stays put.
   */
  async confirmDelete(): Promise<void> {
    const item = this.pendingDelete();
    if (!item) return;

    this.deleteBlocked.set(null);
    try {
      await this.itemsApi.deleteItem(item.id);
      await this.load();
      this.closeDelete();
    } catch (error) {
      this.deleteBlocked.set(
        apiMessage(error, `${item.sku} could not be deleted. Move its stock out and try again.`),
      );
    }
  }
}
