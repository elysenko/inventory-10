import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LocationsService, LocationView } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { MANAGER_ROLES, Roles } from '../auth/decorators/roles.decorator';

@ApiTags('locations')
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  /** Readable by any authenticated user — clerks need it to record movements. */
  @Get()
  findAll(): Promise<LocationView[]> {
    return this.locationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<LocationView> {
    return this.locationsService.findOne(id);
  }

  @Roles(...MANAGER_ROLES)
  @Post()
  create(@Body() dto: CreateLocationDto): Promise<LocationView> {
    return this.locationsService.create(dto);
  }

  @Roles(...MANAGER_ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLocationDto): Promise<LocationView> {
    return this.locationsService.update(id, dto);
  }

  @Roles(...MANAGER_ROLES)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.locationsService.remove(id);
  }
}
