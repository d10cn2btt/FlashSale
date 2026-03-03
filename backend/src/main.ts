import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');

  // Enable CORS — cho phép frontend (localhost:3000) gọi API
  // credentials: true → cho phép gửi httpOnly cookie (refresh token)
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // Bật validation globally — @IsEmail(), @MinLength()... mới có tác dụng
  // whitelist: true → tự động strip các field không có trong DTO (bảo mật)
  // forbidNonWhitelisted: true → throw lỗi nếu client gửi field lạ
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();

