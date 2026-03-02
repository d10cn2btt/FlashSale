import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';

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
}
