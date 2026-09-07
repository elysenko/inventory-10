import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api-client.service';
import type { LowStockRow } from '../../core/models';

/** `/api/reports/low-stock` — manager-only; items where `SUM(qty) <= reorderAt`. */
@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly api = inject(ApiClient);

  lowStock(): Promise<LowStockRow[]> {
    return this.api.get<LowStockRow[]>('/reports/low-stock');
  }
}
