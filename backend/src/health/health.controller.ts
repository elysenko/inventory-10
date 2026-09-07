import { Controller, Get, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../auth/decorators/public.decorator';

interface DeepHealth {
  status: string;
  db: string;
}

/**
 * Both probes are `@Public()`: an auth-gated health check breaks orchestration probes,
 * and a malformed Authorization header must never make a probe fail.
 */
@ApiTags('health')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check(): { status: string } {
    return { status: 'ok' };
  }

  /** Round-trips a query so an unreachable database is reported as 503, not a hang. */
  @Get('deep')
  async deep(): Promise<DeepHealth> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', db: 'ok' };
    } catch {
      throw new ServiceUnavailableException({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        status: 'error',
        db: 'unreachable',
      });
    }
  }
}
