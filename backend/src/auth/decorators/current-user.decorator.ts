import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../auth.types';

/**
 * Injects the user resolved by JwtStrategy from the bearer token.
 * Always prefer this over a client-supplied id: movements are attributed to the
 * token's subject, never to a body field.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    return request.user as AuthUser;
  },
);
