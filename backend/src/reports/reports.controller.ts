import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LowStockRow, ReportsService } from './reports.service';
import { MANAGER_ROLES, Roles } from '../auth/decorators/roles.decorator';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Roles(...MANAGER_ROLES)
  @Get('low-stock')
  lowStock(): Promise<LowStockRow[]> {
    return this.reportsService.lowStock();
  }
}
