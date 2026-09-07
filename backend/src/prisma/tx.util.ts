import { Prisma } from '@prisma/client';

/** Postgres serialization-failure / deadlock signatures Prisma surfaces. */
const RETRYABLE_CODES = new Set(['P2034']);
const RETRYABLE_PATTERNS = [
  'could not serialize',
  'deadlock detected',
  '40001',
  '40P01',
  'write conflict',
];

/**
 * True when the error is a transient write conflict from a serializable transaction
 * (as opposed to a business-rule rejection, which must propagate untouched).
 */
export function isWriteConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && RETRYABLE_CODES.has(error.code)) {
    return true;
  }
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return RETRYABLE_PATTERNS.some((pattern) => message.includes(pattern));
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `work` up to `attempts` times, retrying only on write conflicts. Concurrent
 * writers therefore serialize instead of surfacing a spurious 500; every other
 * error (404 / 400 / 409) propagates on the first throw.
 */
export async function withWriteConflictRetry<T>(
  work: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if (!isWriteConflict(error)) throw error;
      lastError = error;
      await sleep(15 * (attempt + 1));
    }
  }
  throw lastError;
}

/** Prisma's known-error code, or null for anything else. */
export function prismaErrorCode(error: unknown): string | null {
  return error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null;
}
