import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma/prisma.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // dùng được ở mọi module, không cần import lại
    }),
    PrismaModule, // @Global() — đăng ký 1 lần, dùng được ở mọi module
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
