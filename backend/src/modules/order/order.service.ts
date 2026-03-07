import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FlashSaleStatus } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────
  // Cách 2: DB Optimistic Lock
  // Gộp check + increment thành 1 câu UPDATE atomic ở DB level
  // ─────────────────────────────────────────────────────────────
  async create(userId: string, dto: CreateOrderDto) {
    const sale = await this.prisma.flashSale.findFirst({
      where: { id: dto.flashSaleId, deletedAt: null },
    });

    if (!sale) throw new NotFoundException('Flash sale không tồn tại');

    const now = new Date();
    if (
      sale.status !== FlashSaleStatus.ACTIVE ||
      now < sale.startAt ||
      now > sale.endAt
    ) {
      throw new BadRequestException('Flash sale không còn hiệu lực');
    }

    // Atomic: check soldQty < maxQty VÀ increment trong 1 lệnh SQL
    // Nếu soldQty đã >= maxQty → WHERE không match → 0 rows affected → sold out
    const updated = await this.prisma.$queryRaw<{ id: string; discount_price: number }[]>`
      UPDATE flash_sales
      SET sold_qty = sold_qty + 1
      WHERE id = ${sale.id}
        AND sold_qty < max_qty
      RETURNING id, discount_price
    `;

    if (updated.length === 0) {
      throw new BadRequestException('Hết hàng');
    }

    const order = await this.prisma.order.create({
      data: {
        userId,
        flashSaleId: sale.id,
        qty: 1,
        totalPrice: updated[0].discount_price,
      },
    });

    return order;
  }

  async findByUser(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId, deletedAt: null },
      include: {
        flashSale: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { data: orders };
  }
}

