import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid'; // để tạo unique ID cho refresh token (jti)

@Injectable()
export class AuthService {
  // PrismaService được inject tự động vì PrismaModule là @Global()
  constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService) {}

  async register(dto: RegisterDto) {
    // Bước 1: Check email đã tồn tại chưa
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      // 409 Conflict — email đã được dùng
      throw new ConflictException({
        error: { code: 'EMAIL_TAKEN', message: 'Email đã được sử dụng' },
      });
    }

    // Bước 2: Hash password — cost factor 10 (~100ms, đủ chậm để chống brute-force)
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Bước 3: Insert vào DB
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        // role mặc định CUSTOMER — không cho client tự set
      },
    });

    // Bước 4: Return user info — KHÔNG trả về passwordHash
    const { passwordHash: _, ...result } = user;
    return result;
  }

  async login(loginDto: LoginDto) {
    // Bước 1: Tìm user theo email
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email }
    })

    if (!user) {
      // 401 Unauthorized — dùng message chung, không nói rõ email hay password sai
      // tránh user enumeration attack (attacker biết email nào tồn tại)
      throw new UnauthorizedException({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng' }
      })
    }

    // Bước 2: So sánh password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash)
    if (!isPasswordValid) {
      // Cùng message với trên — không phân biệt sai email hay sai password
      throw new UnauthorizedException({
        error: { code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng' }
      })
    }

    // Bước 3: Generate Access Token
    // payload dùng `sub` theo chuẩn JWT RFC 7519 (sub = subject = ID của user)
    // secret và expiresIn đã config trong JwtModule.register() tại auth.module.ts
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const jti = uuidv4(); // unique identifier cho token này, dùng để revoke nếu cần
    const family = uuidv4(); // unique identifier cho cả "gia đình" token (access + refresh), dùng để revoke cả 2 nếu cần
    const refreshToken = this.jwtService.sign({
      sub: user.id,
      jti, // thêm jti vào payload của refresh token
    }, {
      secret: process.env.JWT_REFRESH_SECRET, // secret riêng cho refresh token
      expiresIn: '7d', // hardcode để khớp với expiresAt bên dưới
    });

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        family,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // now + 7 ngày, khớp với expiresIn: '7d'
      }
    })

    return { accessToken, refreshToken };
  }
}
