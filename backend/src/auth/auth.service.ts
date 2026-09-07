import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { withWriteConflictRetry, prismaErrorCode } from '../prisma/tx.util';
import type { AuthResponse, AuthUser, JwtPayload } from './auth.types';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';

const BCRYPT_ROUNDS = 10;
/** Deliberately identical for "unknown email" and "wrong password" — no enumeration oracle. */
const INVALID_CREDENTIALS = 'Invalid email or password.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /**
   * Register. The user count and the insert share ONE serializable transaction, so two
   * concurrent first signups cannot both read `count === 0` and both become ADMIN —
   * the loser is retried and lands as USER.
   */
  async signup(dto: SignupDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const name = dto.name?.trim() ? dto.name.trim() : null;
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const user = await withWriteConflictRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
            const existing = await tx.user.findFirst({
              where: { email: { equals: email, mode: 'insensitive' } },
              select: { id: true },
            });
            if (existing) throw new ConflictException('That email is already registered.');

            const userCount = await tx.user.count();
            const role: Role = userCount === 0 ? Role.ADMIN : Role.USER;

            return tx.user.create({ data: { email, name, passwordHash, role } });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        ),
      );
      return this.issueToken(user);
    } catch (error) {
      if (prismaErrorCode(error) === 'P2002') {
        throw new ConflictException('That email is already registered.');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = dto.email.trim();
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (!user) throw new UnauthorizedException(INVALID_CREDENTIALS);

    const matches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!matches) throw new UnauthorizedException(INVALID_CREDENTIALS);

    return this.issueToken(user);
  }

  /** Strips `passwordHash` before anything leaves the service. */
  toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  private issueToken(user: User): AuthResponse {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    return { accessToken: this.jwt.sign(payload), user: this.toAuthUser(user) };
  }
}
