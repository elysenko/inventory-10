import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import type { LowStockRow } from '../../core/models';
import { ReportsApi } from '../../shared/api/reports-api.service';
import { apiMessage } from '../../shared/api/api-client.service';

@Component({
  selector: 'app-low-stock',
  imports: [RouterLink],
  templateUrl: './low-stock.component.html',
  styleUrl: './low-stock.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LowStockComponent implements OnInit {
  private readonly reportsApi = inject(ReportsApi);
  readonly auth = inject(AuthService);

  /**
   * `GET /api/reports/low-stock` — items where `SUM(qty) <= reorderAt`, ordered by
   * shortfall descending. Items with no stock rows at all are included at zero, and
   * an item sitting exactly on its threshold is included by the inclusive predicate.
   */
  readonly rows = signal<LowStockRow[]>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly outOfStock = computed(() => this.rows().filter((row) => row.onHand === 0).length);
  readonly totalShortfall = computed(() =>
    this.rows().reduce((sum, row) => sum + row.shortfall, 0),
  );

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.rows.set(await this.reportsApi.lowStock());
    } catch (error) {
      this.error.set(apiMessage(error, 'Could not load the low-stock report. Try again.'));
    } finally {
      this.loading.set(false);
    }
  }
}
