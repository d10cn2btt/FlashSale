import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from 'src/common/redis/redis.service';
import { AuthErrors } from 'src/common/errors/auth.errors';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày
const GRACE_PERIOD_SECONDS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
  ) {}

  async register(dto: RegisterDto) {
    // Bước 1: Check email đã tồn tại chưa
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw AuthErrors.emailTaken();
    }

    // Bước 2: Hash password — cost factor 10 (~100ms, đủ chậm để chống brute-force)
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Bước 3: Insert vào DB
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        // role mặc định CUSTOMER — không cho client tự set
      },
    });

    // Bước 4: Return user info — KHÔNG trả về passwordHash
    const { passwordHash: _, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: loginDto.email } });

    if (!user) {
      // message chung — không phân biệt sai email hay password (tránh user enumeration attack)
      throw AuthErrors.invalidCredentials();
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw AuthErrors.invalidCredentials();
    }

    const family = uuidv4(); // mỗi lần login = 1 session mới = 1 family mới
    return this.generateTokenPair(user, family);
  }

  async logout(accessToken: string) {
    // Decode không cần verify — token đã qua JwtAuthGuard rồi
    const payload = this.jwtService.decode(accessToken) as { jti: string; exp: number; family: string };

    const ttl = payload.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      try {
        await this.redisService.setBlacklistToken(payload.jti, ttl);
      } catch {
        // Redis lỗi → fail-closed: không cho logout giả — security > availability
        throw AuthErrors.serviceUnavailable();
      }
    }

    await this.revokeFamily(payload.family);
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; jti: string };
    try {
      payload = this.jwtService.verify(refreshToken, { secret: process.env.JWT_REFRESH_SECRET });
    } catch {
      throw AuthErrors.invalidToken();
    }

    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!tokenRecord) {
      throw AuthErrors.invalidToken();
    }

    if (tokenRecord.revokedAt) {
      const secondsSinceRevoke = (Date.now() - tokenRecord.revokedAt.getTime()) / 1000;

      if (secondsSinceRevoke < GRACE_PERIOD_SECONDS) {
        // Multi-tab race condition — reject nhẹ, không nuclear
        throw AuthErrors.tokenRevoked();
      }

      // Reuse sau grace period → token theft → nuclear: revoke toàn bộ session
      await this.revokeFamily(tokenRecord.family);
      throw AuthErrors.tokenReuseDetected();
    }

    // Rotation: revoke token hiện tại, cấp cặp mới cùng family
    await this.prisma.refreshToken.update({ where: { id: tokenRecord.id }, data: { revokedAt: new Date() } });
    return this.generateTokenPair(tokenRecord.user, tokenRecord.family);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async generateTokenPair(user: { id: string; email: string; role: string }, family: string) {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      jti: uuidv4(),  // để blacklist khi logout
      family,         // để revoke đúng session khi logout
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id, jti: uuidv4() },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d' },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        family,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true },
    });
    return { user };
  }

  private revokeFamily(family: string) {
    return this.prisma.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}