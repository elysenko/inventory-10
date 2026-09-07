import { Logger } from '@nestjs/common';
import type { JwtSignOptions } from '@nestjs/jwt';

const FALLBACK_SECRET = 'stockroom-development-secret-change-me';
const logger = new Logger('JwtConfig');
let warned = false;

/**
 * The signing secret. `JWT_SECRET` is platform-provisioned; the fallback exists so a
 * missing value degrades to a dev secret with a loud warning rather than crash-looping
 * the pod at boot.
 */
export function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim()) return secret;
  if (!warned) {
    warned = true;
    logger.warn('JWT_SECRET is not set — falling back to an insecure development secret.');
  }
  return FALLBACK_SECRET;
}

/** Token lifetime; `JWT_EXPIRES_IN` (or the platform's `JWT_EXPIRATION`) wins when set. */
export function jwtExpiresIn(): string {
  return process.env.JWT_EXPIRES_IN ?? process.env.JWT_EXPIRATION ?? '12h';
}

/**
 * `expiresIn` is typed as the `ms` template-literal union, which a runtime-sourced
 * string can never satisfy statically; jsonwebtoken accepts any valid `ms` string
 * (e.g. `12h`, `1d`), so the widening cast happens here in one place.
 */
export function jwtSignOptions(): JwtSignOptions {
  return { expiresIn: jwtExpiresIn() } as unknown as JwtSignOptions;
}
