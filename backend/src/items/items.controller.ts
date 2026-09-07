import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { QueryItemsDto } from './dto/query-items.dto';
import { MANAGER_ROLES, Roles } from '../auth/decorators/roles.decorator';
import type { ItemDetailView, ItemView } from './items.types';

@ApiTags('items')
@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  findAll(@Query() query: QueryItemsDto): Promise<ItemView[]> {
    return this.itemsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ItemDetailView> {
    return this.itemsService.findOne(id);
  }

  @Roles(...MANAGER_ROLES)
  @Post()
  create(@Body() dto: CreateItemDto): Promise<ItemView> {
    return this.itemsService.create(dto);
  }

  @Roles(...MANAGER_ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateItemDto): Promise<ItemView> {
    return this.itemsService.update(id, dto);
  }

  @Roles(...MANAGER_ROLES)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.itemsService.remove(id);
  }
}
