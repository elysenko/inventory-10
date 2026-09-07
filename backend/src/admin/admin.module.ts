import { Module } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { ConfigResolver } from '../lib/config';

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, ConfigResolver],
  exports: [SettingsService, ConfigResolver],
})
export class AdminModule {}
