import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const products = await this.prisma.product.findMany({
      where: { deletedAt: null },
      include: { inventory: true },
      orderBy: { createdAt: 'desc' },
    });

    return { data: products };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: { inventory: true },
    });

    if (!product) {
      throw new NotFoundException({
        error: { code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
      });
    }

    return { data: product };
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

    return { data: product };
  }

  async remove(id: string) {
    await this.findOne(id); // throw 404 nếu không tồn tại

    // Soft delete: set deletedAt thay vì xoá thật
    await this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { data: { message: 'Product deleted successfully' } };
  }
}
