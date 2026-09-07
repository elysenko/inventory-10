/** Row shape of `GET /api/items` — mirrors the SPA's `Item` interface exactly. */
export interface ItemView {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  reorderAt: number;
  totalQty: number;
  lowStock: boolean;
}

/** One per-location balance inside `GET /api/items/:id`. */
export interface StockLevelView {
  locationId: string;
  locationName: string;
  zone: string;
  qty: number;
}

export interface ItemDetailView extends ItemView {
  levels: StockLevelView[];
}
