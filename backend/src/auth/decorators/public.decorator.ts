import { SetMetadata, CustomDecorator } from '@nestjs/common';

/** Metadata key read by {@link JwtAuthGuard} to skip authentication. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opt a route out of the globally registered JwtAuthGuard.
 * Auth is deny-by-default; only `/auth/login`, `/auth/signup` and the health
 * probes carry this decorator.
 */
export const Public = (): CustomDecorator<string> => SetMetadata(IS_PUBLIC_KEY, true);
