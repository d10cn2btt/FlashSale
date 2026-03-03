import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  constructor(private configService: ConfigService) {
    super({
      host: configService.getOrThrow('REDIS_HOST'),
      port: configService.getOrThrow<number>('REDIS_PORT'),
    });
  }

  async onModuleInit() {
    console.log("Redis connected");
  }

  async onModuleDestroy() {
    await this.quit();
  }

  async setBlacklistToken(jti: string, ttl: number) {
    return await this.set(`blacklist:token:${jti}`, '1', 'EX', ttl);
  }

  async getBlacklistToken(jti: string) {
    return await this.get(`blacklist:token:${jti}`);
  }
}