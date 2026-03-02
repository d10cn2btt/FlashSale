import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('register')
    async register(@Body() dto: RegisterDto) {
        const data = await this.authService.register(dto);
        return { data };
    }

    @Post('login')
    async login(@Body() loginDto: LoginDto) {
        const data = await this.authService.login(loginDto);
        return { data };
    }
}
