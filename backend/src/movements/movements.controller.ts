import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MovementsService } from './movements.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';
import { MANAGER_ROLES, Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import type { MovementPage, MovementResult } from './movements.types';

@ApiTags('movements')
@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  /** Any authenticated user may record stock — recording is the clerk's core job. */
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateMovementDto): Promise<MovementResult> {
    return this.movementsService.create(user, dto);
  }

  /** The audit log itself is manager-only. */
  @Roles(...MANAGER_ROLES)
  @Get()
  findAll(@Query() query: QueryMovementsDto): Promise<MovementPage> {
    return this.movementsService.findAll(query);
  }
}
