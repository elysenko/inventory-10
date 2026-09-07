import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigResolver } from '../lib/config';
import { PrismaService } from '../prisma/prisma.service';
import { CREDENTIAL_KEYS, CREDENTIAL_KEY_SET } from './settings.catalog';

/** Mirrors the SPA's `SettingEntry`. `value` is always masked — never the raw secret. */
export interface SettingEntry {
  key: string;
  service: string;
  label: string;
  value: string;
  configured: boolean;
  hint: string;
}

/** Fixed-width mask: reveals that a value exists without leaking its length or content. */
const MASK = '••••••••';

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigResolver,
  ) {}

  async list(): Promise<SettingEntry[]> {
    return Promise.all(
      CREDENTIAL_KEYS.map(async (entry) => {
        const resolved = await this.config.resolveConfig(entry.key);
        return {
          key: entry.key,
          service: entry.service,
          label: entry.label,
          hint: entry.hint,
          configured: resolved !== null,
          value: resolved !== null ? MASK : '',
        };
      }),
    );
  }

  /**
   * Upserts (never inserts blindly) so repeated saves leave exactly one row per key.
   * Blank drafts mean "leave the stored value alone" and are skipped.
   */
  async update(payload: Record<string, unknown>): Promise<SettingEntry[]> {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('Body must be an object of credential key/value pairs.');
    }

    const writes: { key: string; value: string }[] = [];
    for (const [key, value] of Object.entries(payload)) {
      if (!CREDENTIAL_KEY_SET.has(key)) {
        throw new BadRequestException(`"${key}" is not a configurable credential key.`);
      }
      if (typeof value !== 'string') {
        throw new BadRequestException(`"${key}" must be a string value.`);
      }
      if (value.trim() === '') continue;
      writes.push({ key, value: value.trim() });
    }

    for (const write of writes) {
      await this.prisma.systemSetting.upsert({
        where: { key: write.key },
        create: { key: write.key, value: write.value },
        update: { value: write.value },
      });
    }

    return this.list();
  }
}
