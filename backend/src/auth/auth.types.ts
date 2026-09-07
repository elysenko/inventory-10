import { Role } from '@prisma/client';

/** The sanitized identity attached to `req.user`; never carries `passwordHash`. */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  createdAt: Date;
}

/** Signed JWT payload. `sub` is the user id. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}
