import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Value written by deploy tooling when a credential is deliberately left unset. */
export const PLACEHOLDER = 'PLACEHOLDER_CONFIGURE_IN_SETTINGS';

/**
 * Thrown by a feature whose credentials are absent. A missing third-party key must
 * degrade that one feature (503) — never crash the process at boot.
 */
export class ServiceUnconfiguredError extends HttpException {
  constructor(service: string, key: string) {
    super(`${service} is not configured (${key} is missing).`, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

@Injectable()
export class ConfigResolver {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolution order: environment variable, then the `SystemSetting` row an admin set
   * from the settings screen, then null. Never throws — callers decide how to degrade.
   */
  async resolveConfig(key: string): Promise<string | null> {
    const fromEnv = process.env[key];
    if (fromEnv && fromEnv !== PLACEHOLDER) return fromEnv;

    try {
      const setting = await this.prisma.systemSetting.findUnique({ where: { key } });
      if (setting?.value && setting.value !== PLACEHOLDER) return setting.value;
    } catch {
      // The settings table is a convenience layer; a read failure must not break callers.
    }
    return null;
  }
}

export function isUnconfigured(value: string | null): boolean {
  return !value || value === PLACEHOLDER;
}
