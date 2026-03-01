import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// NOTE: Prisma v7 dùng Driver Adapter pattern — PrismaClient cần nhận adapter
// thay vì tự đọc DATABASE_URL. Pool được tạo 1 lần và tái sử dụng.
// Soft delete filter (deletedAt: null) được xử lý tại từng Service method.

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onApplicationShutdown() {
    await this.$disconnect();
  }
}