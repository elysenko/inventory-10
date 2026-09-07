import { Prisma } from '@prisma/client';

/** Prisma's own code for "transaction failed due to a write conflict or deadlock". */
const RETRYABLE_CODES = new Set(['P2034']);

/**
 * Postgres serialization-failure / deadlock signatures. Postgres raises these as
 * SQLSTATE 40001 / 40P01, which Prisma sometimes surfaces raw rather than as P2034.
 */
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
 *
 * Message matching is deliberately scoped to Prisma's own error classes. Matching the
 * message of *any* Error would misclassify our business-rule rejections, whose text
 * interpolates user-supplied data — an insufficient-stock 400 for a location named
 * "Bay 40001" would otherwise look retryable and burn three attempts before surfacing.
 */
export function isWriteConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_CODES.has(error.code) || matchesPattern(error.message);
  }
  // Raw driver errors Prisma could not classify — the only other place a serialization
  // failure can hide.
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return matchesPattern(error.message);
  }
  return false;
}

function matchesPattern(message: string): boolean {
  const lower = message.toLowerCase();
  return RETRYABLE_PATTERNS.some((pattern) => lower.includes(pattern.toLowerCase()));
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
