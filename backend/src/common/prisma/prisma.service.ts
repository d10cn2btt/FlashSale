import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common';
import { PrismaClient } from '../../../generated/prisma/client';

// NOTE: Prisma v5+ đã xoá $use() middleware.
// Soft delete filter (deletedAt: null) được xử lý tại từng Service method,
// không xử lý tự động tại đây để đảm bảo rõ ràng và dễ debug.

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  async onModuleInit() {
    await this.$connect();
  }

  async onApplicationShutdown() {
    await this.$disconnect();
  }
}