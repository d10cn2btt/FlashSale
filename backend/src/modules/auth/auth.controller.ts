import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Public() // đánh dấu route này là public, không cần JWT
  async register(@Body() dto: RegisterDto) {
    const data = await this.authService.register(dto);
    return { data };
  }

  @Post('login')
  @Public()
  async login(@Body() loginDto: LoginDto) {
    const data = await this.authService.login(loginDto);
    return { data };
  }

  @Post('logout')
  async logout(@Req() request: Request, @CurrentUser() _user: { id: string }) {
    const token = request.headers['authorization']?.split(' ')[1];
    await this.authService.logout(token);

    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  @Public()
  async refresh(@Body('refreshToken') refreshToken: string) {
    const data = await this.authService.refresh(refreshToken);

    return { data };
  }

  @Get('me')
  async me(@CurrentUser() user: { id: string; email: string; role: string }) {
    // CurrentUser decorator lấy từ JWT payload (đã verify bởi JwtAuthGuard)
    // Gọi service để lấy full user data từ DB
    const data = await this.authService.getMe(user.id);
    return { data };
  }
}
