import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { ApiError } from '../../utils/ApiError';
import { RegisterInput, LoginInput, RefreshTokenInput } from './auth.schema';
import { Role } from '@prisma/client';

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
  };
}

export class AuthService {
  // Generate signed JWT access and refresh tokens
  private generateTokens(userId: string, email: string, role: Role) {
    const accessToken = jwt.sign(
      { sub: userId, email, role },
      env.JWT_ACCESS_SECRET,
      { expiresIn: env.JWT_ACCESS_EXPIRES as `${number}${'m' | 'h' | 'd'}` },
    );

    const refreshToken = jwt.sign(
      { sub: userId, email, role },
      env.JWT_REFRESH_SECRET,
      { expiresIn: env.JWT_REFRESH_EXPIRES as `${number}${'m' | 'h' | 'd'}` },
    );

    return { accessToken, refreshToken };
  }

  // Register a new customer or staff member
  async register(data: RegisterInput): Promise<TokenResponse> {
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      throw ApiError.conflict('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        name: data.name,
        role: (data.role as Role) || Role.CUSTOMER,
      },
    });

    const tokens = this.generateTokens(user.id, user.email, user.role);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  // Authenticate user with email and password
  async login(data: LoginInput): Promise<TokenResponse> {
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (!user) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw ApiError.unauthorized('Invalid email or password');
    }

    const tokens = this.generateTokens(user.id, user.email, user.role);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  // Refresh access token using a valid refresh token
  async refresh(data: RefreshTokenInput): Promise<{ accessToken: string }> {
    try {
      const decoded = jwt.verify(data.refreshToken, env.JWT_REFRESH_SECRET) as {
        sub: string;
        email: string;
        role: Role;
      };

      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
      });

      if (!user) {
        throw ApiError.unauthorized('User not found');
      }

      const accessToken = jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        env.JWT_ACCESS_SECRET,
        { expiresIn: env.JWT_ACCESS_EXPIRES as `${number}${'m' | 'h' | 'd'}` },
      );

      return { accessToken };
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw ApiError.unauthorized('Refresh token has expired, please login again');
      }
      throw ApiError.unauthorized('Invalid refresh token');
    }
  }
}

export const authService = new AuthService();
