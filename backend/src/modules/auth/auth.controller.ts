import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response, Request } from 'express'; // ← Express Response — có method cookie(), clearCookie()
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthErrors } from 'src/common/errors/auth.errors';
import { ThrottlerGuard } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public() // đánh dấu route này là public, không cần JWT
  @UseGuards(ThrottlerGuard)
  async register(@Body() dto: RegisterDto) {
    const data = await this.authService.register(dto);
    return { data };
  }

  @Post('login')
  @Public()
  @UseGuards(ThrottlerGuard)
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken } = await this.authService.login(loginDto);
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true, // JS frontend không đọc được cookie này (bảo mật)
      sameSite: 'strict', // chỉ gửi cookie khi cùng domain (CSRF protection)
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
      path: '/api/v1/auth', // ← nên thêm: cookie chỉ gửi đến /auth endpoints, không gửi đi lung tung
    });
    return { data: { accessToken } };
  }

  @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) res: Response) {
    const token = request.headers['authorization']?.split(' ')[1];
    if (!token) {
      throw AuthErrors.invalidToken();
    }

    await this.authService.logout(token);
    res.clearCookie('refreshToken', { path: '/api/v1/auth' }); // xóa cookie ở client

    return { data: {message: 'Logged out successfully' } };
  }

  @Post('refresh')
  @Public()
  async refresh(@Req() request: Request, @Res({ passthrough: true }) res: Response) {
    const { accessToken, refreshToken: newRefreshToken } = await this.authService.refresh(request.cookies.refreshToken);
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    return { data: { accessToken } };
  }

  @Get('me')
  async me(@CurrentUser() user: { id: string; email: string; role: string }) {
    // CurrentUser decorator lấy từ JWT payload (đã verify bởi JwtAuthGuard)
    // Gọi service để lấy full user data từ DB
    const data = await this.authService.getMe(user.id);
    return { data };
  }
}
