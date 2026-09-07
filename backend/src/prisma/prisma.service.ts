import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * The single PrismaClient for the process.
 *
 * `onModuleDestroy` is what actually drains the pool: Nest calls it during
 * `app.close()`, which `enableShutdownHooks()` in main.ts wires to SIGTERM. Kubernetes
 * sends SIGTERM before removing the pod from the Service, so without this the pool is
 * torn down by process exit and in-flight queries are cut off mid-rollout.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
