import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CacheService } from 'src/common/cache/cache.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const TTL = 5 * 60; // 5 phút

const CacheKeys = {
  list: () => 'products:list',
  detail: (id: string) => `products:${id}`,
};

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async findAll() {
    const cached = await this.cache.get(CacheKeys.list());
    if (cached) return cached;

    const products = await this.prisma.product.findMany({
      where: { deletedAt: null },
      include: { inventory: true },
      orderBy: { createdAt: 'desc' },
    });

    const result = { data: products };
    await this.cache.set(CacheKeys.list(), result, TTL);
    return result;
  }

  async findOne(id: string) {
    const cached = await this.cache.get(CacheKeys.detail(id));
    if (cached) return cached;

    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: { inventory: true },
    });

    if (!product) {
      throw new NotFoundException({
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
      });
    }

    const result = { data: product };
    await this.cache.set(CacheKeys.detail(id), result, TTL);
    return result;
  }

  async create(dto: CreateProductDto) {
    // $transaction: tạo Product + Inventory cùng lúc
    // Nếu 1 trong 2 fail → cả 2 đều rollback → không bao giờ có product thiếu inventory
    const product = await this.prisma.$transaction(async (tx) => {
      return tx.product.create({
        data: {
          name: dto.name,
          description: dto.description,
          price: dto.price,
          imageUrl: dto.imageUrl,
          inventory: {
            create: { quantity: dto.quantity }, // nested write
          },
        },
        include: { inventory: true },
      });
    });

    await this.cache.del(CacheKeys.list());
    return { data: product };
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id); // throw 404 nếu không tồn tại

    // Tách quantity ra: nó thuộc Inventory, không phải Product
    const { quantity, ...productData } = dto;

    const product = await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: productData,
      });

      if (quantity !== undefined) {
        await tx.inventory.update({
          where: { productId: id },
          data: { quantity },
        });
      }

      return tx.product.findUnique({
        where: { id },
        include: { inventory: true },
      });
    });

    await this.cache.del(CacheKeys.list(), CacheKeys.detail(id));
    return { data: product };
  }

  async remove(id: string) {
    await this.findOne(id); // throw 404 nếu không tồn tại

    // Soft delete: set deletedAt thay vì xoá thật
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.cache.del(CacheKeys.list(), CacheKeys.detail(id));
    return { data: { message: 'Product deleted successfully' } };
  }
}
