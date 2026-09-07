import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One round-trip. The LEFT JOIN keeps items that have no StockLevel rows at all
   * (they read as 0 on hand), and the HAVING clause is the spec's inclusive `<=`
   * boundary. SUM() is cast to int so no BigInt reaches JSON serialization.
   */
  async lowStock(): Promise<LowStockRow[]> {
    return this.prisma.$queryRaw<LowStockRow[]>`
      SELECT i.id                                             AS "itemId",
             i.sku                                            AS "sku",
             i.name                                           AS "name",
             i.unit                                           AS "unit",
             COALESCE(SUM(s.qty), 0)::int                     AS "onHand",
             i."reorderAt"                                    AS "reorderAt",
             (i."reorderAt" - COALESCE(SUM(s.qty), 0))::int   AS "shortfall"
      FROM "Item" i
      LEFT JOIN "StockLevel" s ON s."itemId" = i.id
      GROUP BY i.id, i.sku, i.name, i.unit, i."reorderAt"
      HAVING COALESCE(SUM(s.qty), 0) <= i."reorderAt"
      ORDER BY "shortfall" DESC, i.sku ASC
    `;
  }
}
