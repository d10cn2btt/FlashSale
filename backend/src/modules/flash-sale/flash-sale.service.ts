import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CacheService } from 'src/common/cache/cache.service';
import { CreateFlashSaleDto } from './dto/create-flash-sale.dto';

const CacheKeys = {
  active: () => 'flash-sales:active',
};

@Injectable()
export class FlashSaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findActive() {
    const cached = await this.cache.get(CacheKeys.active());
    if (cached) return cached;

    const now = new Date();

    const flashSales = await this.prisma.flashSale.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        startAt: { lte: now }, // đã bắt đầu
        endAt: { gte: now },   // chưa kết thúc
      },
      include: { product: true },
      orderBy: { endAt: 'asc' }, // sắp hết hạn trước
    });

    const result = { data: flashSales };
    await this.cache.set(CacheKeys.active(), result, 30); // TTL 30s — data thay đổi thường xuyên
    return result;
  }

  async findOne(id: string) {
    const flashSale = await this.prisma.flashSale.findFirst({
      where: { id, deletedAt: null },
      include: { product: true },
    });

    if (!flashSale) {
      throw new NotFoundException({
        error: { code: 'FLASH_SALE_NOT_FOUND', message: 'Flash sale not found' },
      });
    }

    return { data: flashSale };
  }

  async create(dto: CreateFlashSaleDto) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    // Validate: endAt phải sau startAt
    if (endAt <= startAt) {
      throw new BadRequestException({
        error: { code: 'INVALID_DATE_RANGE', message: 'endAt phải sau startAt' },
      });
    }

    // Kiểm tra product tồn tại
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, deletedAt: null },
    });

    if (!product) {
      throw new NotFoundException({
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
      });
    }

    const flashSale = await this.prisma.flashSale.create({
      data: {
        productId: dto.productId,
        discountPrice: dto.discountPrice,
        maxQty: dto.maxQty,
        startAt,
        endAt,
        // status mặc định là UPCOMING (theo schema)
      },
      include: { product: true },
    });

    await this.cache.del(CacheKeys.active());
    return { data: flashSale };
  }
}
