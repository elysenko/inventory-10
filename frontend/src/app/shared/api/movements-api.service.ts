import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api-client.service';
import type { Movement, MovementPage, MovementType } from '../../core/models';

export interface CreateMovementPayload {
  type: MovementType;
  itemId: string;
  fromLocId?: string;
  toLocId?: string;
  qty: number;
  note?: string;
}

/** A balance touched by the movement, echoed back so the UI need not refetch. */
export interface AffectedBalance {
  locationId: string;
  locationName: string;
  zone: string;
  qty: number;
}

export type MovementResult = Movement & { balances: AffectedBalance[] };

export interface MovementQuery {
  itemId?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/** `/api/movements` — recording is open to any authenticated user; the log is manager-only. */
@Injectable({ providedIn: 'root' })
export class MovementsApi {
  private readonly api = inject(ApiClient);

  /** Paginated and ordered newest-first by the API. */
  listMovements(query?: MovementQuery): Promise<MovementPage> {
    return this.api.get<MovementPage>('/movements', query as Record<string, string | number>);
  }

  /**
   * Runs as one serializable transaction server-side: an OUT/TRANSFER that exceeds the
   * source balance is rejected with 400 and leaves every balance untouched.
   */
  createMovement(payload: CreateMovementPayload): Promise<MovementResult> {
    return this.api.post<MovementResult>('/movements', payload);
  }
}
