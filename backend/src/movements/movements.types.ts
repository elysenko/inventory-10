import { MovementType, Role } from '@prisma/client';

/**
 * Flat, UI-ready projection of a ledger row. Location and user *names* are resolved
 * server-side; the nested `item`/`user`/`fromLoc`/`toLoc` objects are kept alongside
 * the flat fields so either access style works.
 */
export interface MovementView {
  id: string;
  type: MovementType;
  itemId: string;
  itemSku: string;
  itemName: string;
  item: { id: string; sku: string; name: string };
  fromLocId: string | null;
  fromLocName: string | null;
  fromLoc: { id: string; name: string; zone: string } | null;
  toLocId: string | null;
  toLocName: string | null;
  toLoc: { id: string; name: string; zone: string } | null;
  qty: number;
  note: string | null;
  userId: string;
  userEmail: string;
  userRole: Role;
  user: { id: string; email: string; role: Role };
  createdAt: Date;
}

export interface MovementPage {
  data: MovementView[];
  total: number;
  page: number;
  pageSize: number;
}

/** A balance touched by a movement, echoed back so the client can update without refetching. */
export interface AffectedBalance {
  locationId: string;
  locationName: string;
  zone: string;
  qty: number;
}

export type MovementResult = MovementView & { balances: AffectedBalance[] };
