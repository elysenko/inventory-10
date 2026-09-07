import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MovementType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withWriteConflictRetry } from '../prisma/tx.util';
import { CreateMovementDto } from './dto/create-movement.dto';
import { DEFAULT_PAGE_SIZE, QueryMovementsDto } from './dto/query-movements.dto';
import { MOVEMENT_INCLUDE, rangeEnd, rangeStart, toMovementView } from './movements.mapper';
import type { AffectedBalance, MovementPage, MovementResult } from './movements.types';
import type { AuthUser } from '../auth/auth.types';

type Tx = Prisma.TransactionClient;

@Injectable()
export class MovementsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records one movement. The whole read-check-write sequence runs in a single
   * SERIALIZABLE transaction, so an insufficient-stock rejection aborts before any
   * balance is touched and two concurrent writers can never oversell a balance.
   * Write conflicts (P2034) are retried rather than surfaced as 500s.
   */
  async create(user: AuthUser, dto: CreateMovementDto): Promise<MovementResult> {
    return withWriteConflictRetry(() =>
      this.prisma.$transaction((tx) => this.apply(tx, user, dto), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15_000,
        maxWait: 10_000,
      }),
    );
  }

  private async apply(tx: Tx, user: AuthUser, dto: CreateMovementDto): Promise<MovementResult> {
    const fromLocId = dto.fromLocId ?? null;
    const toLocId = dto.toLocId ?? null;

    const item = await tx.item.findUnique({ where: { id: dto.itemId }, select: { id: true } });
    if (!item) throw new NotFoundException(`Item ${dto.itemId} was not found.`);

    const from = fromLocId ? await this.requireLocation(tx, fromLocId) : null;
    const to = toLocId ? await this.requireLocation(tx, toLocId) : null;

    if (from) {
      const source = await tx.stockLevel.findUnique({
        where: { itemId_locationId: { itemId: dto.itemId, locationId: from.id } },
        select: { qty: true },
      });
      const available = source?.qty ?? 0;
      if (available < dto.qty) {
        throw new BadRequestException(
          `Insufficient stock at ${from.name}: ${available} on hand, ${dto.qty} requested.`,
        );
      }
      await tx.stockLevel.update({
        where: { itemId_locationId: { itemId: dto.itemId, locationId: from.id } },
        data: { qty: { decrement: dto.qty } },
      });
    }

    if (to) {
      await tx.stockLevel.upsert({
        where: { itemId_locationId: { itemId: dto.itemId, locationId: to.id } },
        create: { itemId: dto.itemId, locationId: to.id, qty: dto.qty },
        update: { qty: { increment: dto.qty } },
      });
    }

    const movement = await tx.movement.create({
      data: {
        type: dto.type,
        itemId: dto.itemId,
        fromLocId: from?.id ?? null,
        toLocId: to?.id ?? null,
        qty: dto.qty,
        note: dto.note?.trim() ? dto.note.trim() : null,
        // Attribution always comes from the verified token, never from the request body.
        userId: user.id,
      },
      include: MOVEMENT_INCLUDE,
    });

    const touched = [from?.id, to?.id].filter((id): id is string => Boolean(id));
    const balances = await this.readBalances(tx, dto.itemId, touched);

    return { ...toMovementView(movement), balances };
  }

  private async requireLocation(
    tx: Tx,
    id: string,
  ): Promise<{ id: string; name: string; zone: string }> {
    const location = await tx.location.findUnique({
      where: { id },
      select: { id: true, name: true, zone: true },
    });
    if (!location) throw new NotFoundException(`Location ${id} was not found.`);
    return location;
  }

  private async readBalances(tx: Tx, itemId: string, locationIds: string[]): Promise<AffectedBalance[]> {
    if (locationIds.length === 0) return [];
    const levels = await tx.stockLevel.findMany({
      where: { itemId, locationId: { in: locationIds } },
      include: { location: { select: { id: true, name: true, zone: true } } },
    });
    return levels.map((level) => ({
      locationId: level.locationId,
      locationName: level.location.name,
      zone: level.location.zone,
      qty: level.qty,
    }));
  }

  /** Paginated, filterable audit log, newest first. */
  async findAll(query: QueryMovementsDto): Promise<MovementPage> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const from = rangeStart(query.from);
    const to = rangeEnd(query.to);
    const createdAt =
      from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;

    const where: Prisma.MovementWhereInput = {
      ...(query.itemId ? { itemId: query.itemId } : {}),
      ...(query.type ? { type: query.type as MovementType } : {}),
      ...(createdAt ? { createdAt } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.movement.count({ where }),
      this.prisma.movement.findMany({
        where,
        include: MOVEMENT_INCLUDE,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { data: rows.map(toMovementView), total, page, pageSize };
  }
}
