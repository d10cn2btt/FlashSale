import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // dùng được ở mọi module, không cần import lại
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
