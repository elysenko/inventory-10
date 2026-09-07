import { Prisma } from '@prisma/client';
import type { MovementView } from './movements.types';

/** The exact include every movement query uses, so the mapper is always satisfiable. */
export const MOVEMENT_INCLUDE = {
  item: { select: { id: true, sku: true, name: true } },
  fromLoc: { select: { id: true, name: true, zone: true } },
  toLoc: { select: { id: true, name: true, zone: true } },
  user: { select: { id: true, email: true, role: true } },
} satisfies Prisma.MovementInclude;

export type MovementWithRelations = Prisma.MovementGetPayload<{ include: typeof MOVEMENT_INCLUDE }>;

export function toMovementView(movement: MovementWithRelations): MovementView {
  return {
    id: movement.id,
    type: movement.type,
    itemId: movement.itemId,
    itemSku: movement.item.sku,
    itemName: movement.item.name,
    item: movement.item,
    fromLocId: movement.fromLocId,
    fromLocName: movement.fromLoc?.name ?? null,
    fromLoc: movement.fromLoc ?? null,
    toLocId: movement.toLocId,
    toLocName: movement.toLoc?.name ?? null,
    toLoc: movement.toLoc ?? null,
    qty: movement.qty,
    note: movement.note,
    userId: movement.userId,
    userEmail: movement.user.email,
    userRole: movement.user.role,
    user: movement.user,
    createdAt: movement.createdAt,
  };
}

/** `YYYY-MM-DD` widens to the whole UTC day; a full ISO timestamp is used verbatim. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function rangeStart(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = DATE_ONLY.test(value) ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** End-of-day inclusive: `?to=2026-09-07` still matches a movement stamped 23:00 that day. */
export function rangeEnd(value?: string): Date | undefined {
  if (!value) return undefined;
  const date = DATE_ONLY.test(value) ? new Date(`${value}T23:59:59.999Z`) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
