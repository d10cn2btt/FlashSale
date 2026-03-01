import { PrismaClient, Role, FlashSaleStatus, OrderStatus } from '../generated/prisma';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Bắt đầu seed data...');

  // ─────────────────────────────────────────
  // 0. TRUNCATE (xóa theo thứ tự FK)
  // ─────────────────────────────────────────
  await prisma.order.deleteMany();
  await prisma.flashSale.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  console.log('🗑️  Đã xóa dữ liệu cũ');

  // ─────────────────────────────────────────
  // 1. USERS
  // ─────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Password123!', 10);

  const [admin, customer1, customer2, customer3] = await Promise.all([
    prisma.user.create({ data: { email: 'admin@flashdeal.com', passwordHash, role: Role.ADMIN } }),
    prisma.user.create({ data: { email: 'alice@example.com', passwordHash, role: Role.CUSTOMER } }),
    prisma.user.create({ data: { email: 'bob@example.com', passwordHash, role: Role.CUSTOMER } }),
    prisma.user.create({ data: { email: 'charlie@example.com', passwordHash, role: Role.CUSTOMER } }),
  ]);

  console.log('✅ Users: admin, alice, bob, charlie');

  // ─────────────────────────────────────────
  // 2. PRODUCTS + INVENTORY
  // ─────────────────────────────────────────
  const productsData = [
    { name: 'iPhone 15 Pro',       description: 'Apple iPhone 15 Pro 256GB',              price: 28990000, imageUrl: 'https://picsum.photos/seed/iphone/400/400',   stock: 100 },
    { name: 'Samsung Galaxy S24',  description: 'Samsung Galaxy S24 Ultra 512GB',          price: 26990000, imageUrl: 'https://picsum.photos/seed/samsung/400/400',  stock: 80  },
    { name: 'Sony WH-1000XM5',     description: 'Tai nghe chống ồn cao cấp',               price: 7490000,  imageUrl: 'https://picsum.photos/seed/sony/400/400',    stock: 200 },
    { name: 'MacBook Air M3',      description: 'Apple MacBook Air M3 13-inch 8GB 256GB',  price: 32990000, imageUrl: 'https://picsum.photos/seed/macbook/400/400',  stock: 50  },
    { name: 'Logitech MX Master 3S', description: 'Chuột không dây cao cấp',              price: 2290000,  imageUrl: 'https://picsum.photos/seed/logitech/400/400', stock: 300 },
  ];

  const createdProducts = await Promise.all(
    productsData.map((p) =>
      prisma.product.create({
        data: {
          name: p.name,
          description: p.description,
          price: p.price,
          imageUrl: p.imageUrl,
          inventory: { create: { quantity: p.stock } },
        },
      }),
    ),
  );

  const allProducts = createdProducts;
  console.log(`✅ Products: ${allProducts.map((p) => p.name).join(', ')}`);

  // ─────────────────────────────────────────
  // 3. FLASH SALES
  // ─────────────────────────────────────────
  const now = new Date();

  // Flash sale ACTIVE (đang diễn ra)
  const flashSaleActive = await prisma.flashSale.create({
    data: {
      productId: allProducts[0].id, // iPhone 15 Pro
      discountPrice: 24990000,
      maxQty: 50,
      soldQty: 12,
      startAt: new Date(now.getTime() - 60 * 60 * 1000), // 1 giờ trước
      endAt: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 giờ sau
      status: FlashSaleStatus.ACTIVE,
    },
  });

  // Flash sale UPCOMING (sắp diễn ra)
  const flashSaleUpcoming = await prisma.flashSale.create({
    data: {
      productId: allProducts[1].id, // Samsung Galaxy S24
      discountPrice: 19990000,
      maxQty: 30,
      soldQty: 0,
      startAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // ngày mai
      endAt: new Date(now.getTime() + 26 * 60 * 60 * 1000),
      status: FlashSaleStatus.UPCOMING,
    },
  });

  // Flash sale ENDED (đã kết thúc)
  const flashSaleEnded = await prisma.flashSale.create({
    data: {
      productId: allProducts[2].id, // Sony WH-1000XM5
      discountPrice: 4990000,
      maxQty: 20,
      soldQty: 20,
      startAt: new Date(now.getTime() - 48 * 60 * 60 * 1000), // 2 ngày trước
      endAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),   // hôm qua
      status: FlashSaleStatus.ENDED,
    },
  });

  console.log(`✅ FlashSales: ACTIVE (iPhone), UPCOMING (Samsung), ENDED (Sony)`);

  // ─────────────────────────────────────────
  // 4. ORDERS
  // ─────────────────────────────────────────
  await prisma.order.createMany({
    data: [
      {
        userId: customer1.id,
        flashSaleId: flashSaleActive.id,
        qty: 1,
        totalPrice: 24990000,
        status: OrderStatus.CONFIRMED,
      },
      {
        userId: customer2.id,
        flashSaleId: flashSaleActive.id,
        qty: 2,
        totalPrice: 49980000,
        status: OrderStatus.PENDING,
      },
      {
        userId: customer3.id,
        flashSaleId: flashSaleEnded.id,
        qty: 1,
        totalPrice: 4990000,
        status: OrderStatus.CONFIRMED,
      },
    ],
  });

  console.log(`✅ Orders: 3 orders`);
  console.log('');
  console.log('🎉 Seed hoàn tất!');
  console.log('');
  console.log('📋 Test accounts (password: Password123!):');
  console.log('   admin@flashdeal.com   — ADMIN');
  console.log('   alice@example.com     — CUSTOMER');
  console.log('   bob@example.com       — CUSTOMER');
  console.log('   charlie@example.com   — CUSTOMER');
}

main()
  .catch((e) => {
    console.error('❌ Seed thất bại:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
