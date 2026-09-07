import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { prismaErrorCode } from '../prisma/tx.util';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { QueryItemsDto } from './dto/query-items.dto';
import type { ItemDetailView, ItemView } from './items.types';

interface ItemWithQty {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  reorderAt: number;
  stockLevels: { qty: number }[];
}

@Injectable()
export class ItemsService {
  constructor(private readonly prisma: PrismaService) {}

  /** `totalQty` is the sum across locations; `lowStock` is the inclusive `<=` boundary. */
  private toView(item: ItemWithQty): ItemView {
    const totalQty = item.stockLevels.reduce((sum, level) => sum + level.qty, 0);
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      unit: item.unit,
      reorderAt: item.reorderAt,
      totalQty,
      lowStock: totalQty <= item.reorderAt,
    };
  }

  async findAll(query: QueryItemsDto): Promise<ItemView[]> {
    const q = query.q?.trim();
    const items = await this.prisma.item.findMany({
      where: q
        ? {
            OR: [
              { sku: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: { stockLevels: { select: { qty: true } } },
      orderBy: { sku: 'asc' },
    });

    const views = items.map((item) => this.toView(item));
    return query.low ? views.filter((view) => view.lowStock) : views;
  }

  async findOne(id: string): Promise<ItemDetailView> {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: { stockLevels: { include: { location: true }, orderBy: { location: { name: 'asc' } } } },
    });
    if (!item) throw new NotFoundException(`Item ${id} was not found.`);

    return {
      ...this.toView({ ...item, stockLevels: item.stockLevels.map((level) => ({ qty: level.qty })) }),
      levels: item.stockLevels.map((level) => ({
        locationId: level.locationId,
        locationName: level.location.name,
        zone: level.location.zone,
        qty: level.qty,
      })),
    };
  }

  async create(dto: CreateItemDto): Promise<ItemView> {
    try {
      const item = await this.prisma.item.create({
        data: {
          sku: dto.sku,
          name: dto.name,
          description: dto.description ?? null,
          unit: dto.unit,
          reorderAt: dto.reorderAt ?? 0,
        },
        include: { stockLevels: { select: { qty: true } } },
      });
      return this.toView(item);
    } catch (error) {
      throw this.translate(error, dto.sku);
    }
  }

  async update(id: string, dto: UpdateItemDto): Promise<ItemView> {
    await this.requireItem(id);
    try {
      const item = await this.prisma.item.update({
        where: { id },
        data: {
          ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.unit !== undefined ? { unit: dto.unit } : {}),
          ...(dto.reorderAt !== undefined ? { reorderAt: dto.reorderAt } : {}),
        },
        include: { stockLevels: { select: { qty: true } } },
      });
      return this.toView(item);
    } catch (error) {
      throw this.translate(error, dto.sku ?? '');
    }
  }

  /**
   * Deletes are blocked, never cascaded: an item that still holds stock or is
   * referenced by the movement ledger stays put so the audit trail cannot be
   * silently rewritten.
   */
  async remove(id: string): Promise<void> {
    await this.requireItem(id);

    const held = await this.prisma.stockLevel.aggregate({
      where: { itemId: id },
      _sum: { qty: true },
    });
    if ((held._sum.qty ?? 0) > 0) {
      throw new ConflictException('This item still holds stock. Move it out before deleting.');
    }

    const movements = await this.prisma.movement.count({ where: { itemId: id } });
    if (movements > 0) {
      throw new ConflictException(
        'This item has recorded movements and cannot be deleted (audit history is preserved).',
      );
    }

    await this.prisma.item.delete({ where: { id } });
  }

  private async requireItem(id: string): Promise<void> {
    const exists = await this.prisma.item.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Item ${id} was not found.`);
  }

  /**
   * Map Prisma write failures onto the HTTP contract. Returns `unknown` rather than
   * `HttpException` because the fall-through re-throws whatever it was handed.
   *
   * P2002 on `sku` becomes a field-level 409 so the form can highlight the input.
   * P2025 ("record not found") is the TOCTOU loser: the existence check above runs
   * outside the write, so a concurrent delete lands here and must be a 404, not a 500.
   */
  private translate(error: unknown, sku: string): unknown {
    if (prismaErrorCode(error) === 'P2002') {
      return new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        field: 'sku',
        message: `Another item already uses the sku "${sku}". SKUs must be unique.`,
      });
    }
    if (prismaErrorCode(error) === 'P2025') {
      return new NotFoundException('That item no longer exists.');
    }
    return error;
  }
}
