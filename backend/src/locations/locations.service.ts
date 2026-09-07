import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { prismaErrorCode } from '../prisma/tx.util';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

/** Mirrors the SPA's `Location` interface: the list doubles as the movement form's select. */
export interface LocationView {
  id: string;
  name: string;
  zone: string;
  itemCount: number;
  totalQty: number;
}

interface LocationWithLevels {
  id: string;
  name: string;
  zone: string;
  stockLevels: { qty: number }[];
}

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  private toView(location: LocationWithLevels): LocationView {
    const stocked = location.stockLevels.filter((level) => level.qty > 0);
    return {
      id: location.id,
      name: location.name,
      zone: location.zone,
      itemCount: stocked.length,
      totalQty: stocked.reduce((sum, level) => sum + level.qty, 0),
    };
  }

  /** Ordered by name so the UI's select keeps a stable, deterministic order. */
  async findAll(): Promise<LocationView[]> {
    const locations = await this.prisma.location.findMany({
      include: { stockLevels: { select: { qty: true } } },
      orderBy: { name: 'asc' },
    });
    return locations.map((location) => this.toView(location));
  }

  async findOne(id: string): Promise<LocationView> {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: { stockLevels: { select: { qty: true } } },
    });
    if (!location) throw new NotFoundException(`Location ${id} was not found.`);
    return this.toView(location);
  }

  async create(dto: CreateLocationDto): Promise<LocationView> {
    try {
      const location = await this.prisma.location.create({
        data: { name: dto.name, zone: dto.zone },
        include: { stockLevels: { select: { qty: true } } },
      });
      return this.toView(location);
    } catch (error) {
      throw this.translate(error, dto.name);
    }
  }

  async update(id: string, dto: UpdateLocationDto): Promise<LocationView> {
    await this.requireLocation(id);
    try {
      const location = await this.prisma.location.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.zone !== undefined ? { zone: dto.zone } : {}),
        },
        include: { stockLevels: { select: { qty: true } } },
      });
      return this.toView(location);
    } catch (error) {
      throw this.translate(error, dto.name ?? '');
    }
  }

  /** Blocked (409) while the location holds stock or is named by any movement. */
  async remove(id: string): Promise<void> {
    await this.requireLocation(id);

    const held = await this.prisma.stockLevel.aggregate({
      where: { locationId: id },
      _sum: { qty: true },
    });
    if ((held._sum.qty ?? 0) > 0) {
      throw new ConflictException('This location still holds stock. Move it out before deleting.');
    }

    const movements = await this.prisma.movement.count({
      where: { OR: [{ fromLocId: id }, { toLocId: id }] },
    });
    if (movements > 0) {
      throw new ConflictException(
        'This location has recorded movements and cannot be deleted (audit history is preserved).',
      );
    }

    await this.prisma.location.delete({ where: { id } });
  }

  private async requireLocation(id: string): Promise<void> {
    const exists = await this.prisma.location.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Location ${id} was not found.`);
  }

  private translate(error: unknown, name: string): unknown {
    if (prismaErrorCode(error) === 'P2002') {
      return new ConflictException({
        statusCode: 409,
        error: 'Conflict',
        field: 'name',
        message: `Another location is already called "${name}". Location names must be unique.`,
      });
    }
    if (prismaErrorCode(error) === 'P2003') {
      return new ConflictException('This location is referenced by existing records.');
    }
    // TOCTOU loser: the existence check runs outside the write, so a concurrent delete
    // must surface as a 404 rather than an unhandled 500.
    if (prismaErrorCode(error) === 'P2025') {
      return new NotFoundException('That location no longer exists.');
    }
    return error;
  }
}
