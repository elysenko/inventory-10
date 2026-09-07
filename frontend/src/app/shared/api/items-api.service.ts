import { Injectable, inject } from '@angular/core';
import { ApiClient } from './api-client.service';
import type { Item, ItemDetail } from '../../core/models';

export interface CreateItemPayload {
  sku: string;
  name: string;
  description?: string;
  unit: string;
  reorderAt: number;
}

export type UpdateItemPayload = Partial<CreateItemPayload>;

/** `/api/items` — catalogue reads are open to any authenticated user; writes are manager-only. */
@Injectable({ providedIn: 'root' })
export class ItemsApi {
  private readonly api = inject(ApiClient);

  listItems(query?: { q?: string; low?: boolean }): Promise<Item[]> {
    return this.api.get<Item[]>('/items', query);
  }

  /** Includes the per-location `levels` breakdown. */
  getItem(id: string): Promise<ItemDetail> {
    return this.api.get<ItemDetail>(`/items/${encodeURIComponent(id)}`);
  }

  createItem(payload: CreateItemPayload): Promise<Item> {
    return this.api.post<Item>('/items', payload);
  }

  updateItem(id: string, payload: UpdateItemPayload): Promise<Item> {
    return this.api.patch<Item>(`/items/${encodeURIComponent(id)}`, payload);
  }

  /** 409 while the item still holds stock or is referenced by the movement ledger. */
  deleteItem(id: string): Promise<void> {
    return this.api.delete(`/items/${encodeURIComponent(id)}`);
  }
}
