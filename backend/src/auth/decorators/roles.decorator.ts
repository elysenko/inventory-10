import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route to the listed roles. Missing/invalid token still yields 401
 * (JwtAuthGuard runs first); an authenticated user without one of these roles
 * gets 403.
 */
export const Roles = (...roles: Role[]): CustomDecorator<string> => SetMetadata(ROLES_KEY, roles);

/** Manager-level access: the spec's "manager"; ADMIN inherits every manager permission. */
export const MANAGER_ROLES: Role[] = [Role.MANAGER, Role.ADMIN];
