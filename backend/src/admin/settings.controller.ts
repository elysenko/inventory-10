import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { SettingEntry, SettingsService } from './settings.service';
import { Roles } from '../auth/decorators/roles.decorator';

/** Admin-only: managers and clerks get 403, unauthenticated callers get 401. */
@ApiTags('admin')
@Roles(Role.ADMIN)
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  list(): Promise<SettingEntry[]> {
    return this.settingsService.list();
  }

  @Patch()
  update(@Body() body: Record<string, unknown>): Promise<SettingEntry[]> {
    return this.settingsService.update(body);
  }
}
