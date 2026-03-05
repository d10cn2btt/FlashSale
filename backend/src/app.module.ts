import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RedisModule } from './common/redis/redis.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ProductModule } from './modules/product/product.module';
import { FlashSaleModule } from './modules/flash-sale/flash-sale.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // dùng được ở mọi module, không cần import lại
    }),
    PrismaModule, // @Global() — đăng ký 1 lần, dùng được ở mọi module
    UserModule,
    AuthModule,
    RedisModule,
    ProductModule,
    FlashSaleModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 giây (milliseconds)
        limit: 5, // tối đa 5 request trong 60s
      },
    ]),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // đăng ký global guard — áp dụng cho tất cả route
    },
  ],
})
export class AppModule {}
