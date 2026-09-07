/**
 * StockRoom API contract types.
 *
 * These mirror the shapes the NestJS API returns (see the surface contract in the
 * technical plan). The service_agent replaces every mock `signal<T[]>([...])`
 * initializer in the feature components with real calls typed by these interfaces.
 */

export type Role = 'USER' | 'MANAGER' | 'ADMIN';

export type MovementType = 'IN' | 'OUT' | 'TRANSFER';

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

/** Row shape of `GET /api/items` — `totalQty` and `lowStock` are computed server-side. */
export interface Item {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  reorderAt: number;
  totalQty: number;
  lowStock: boolean;
}

/** Per-location balance breakdown returned inside `GET /api/items/:id`. */
export interface StockLevelView {
  locationId: string;
  locationName: string;
  zone: string;
  qty: number;
}

export interface ItemDetail extends Item {
  levels: StockLevelView[];
}

export interface Location {
  id: string;
  name: string;
  zone: string;
  itemCount: number;
  totalQty: number;
}

export interface Movement {
  id: string;
  type: MovementType;
  itemId: string;
  itemSku: string;
  itemName: string;
  fromLocId: string | null;
  fromLocName: string | null;
  toLocId: string | null;
  toLocName: string | null;
  qty: number;
  note: string | null;
  userEmail: string;
  userRole: Role;
  createdAt: string;
}

export interface MovementPage {
  data: Movement[];
  total: number;
  page: number;
  pageSize: number;
}

/** Row shape of `GET /api/reports/low-stock`; `shortfall = reorderAt - onHand`. */
export interface LowStockRow {
  itemId: string;
  sku: string;
  name: string;
  unit: string;
  onHand: number;
  reorderAt: number;
  shortfall: number;
}

/** One credential key from `GET /api/admin/settings`; `value` arrives masked. */
export interface SettingEntry {
  key: string;
  service: string;
  label: string;
  value: string;
  configured: boolean;
  hint: string;
}
