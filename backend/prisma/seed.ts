import { PrismaClient, Role, FlashSaleStatus, OrderStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

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
    prisma.user.create({ data: { email: 'admin@flashdeal.com', name: 'Admin', passwordHash, role: Role.ADMIN } }),
    prisma.user.create({ data: { email: 'alice@example.com', name: 'Alice', passwordHash, role: Role.CUSTOMER } }),
    prisma.user.create({ data: { email: 'bob@example.com', name: 'Bob', passwordHash, role: Role.CUSTOMER } }),
    prisma.user.create({ data: { email: 'charlie@example.com', name: 'Charlie', passwordHash, role: Role.CUSTOMER } }),
  ]);

  console.log('✅ Users: admin, alice, bob, charlie');

  // ─────────────────────────────────────────
  // 2. PRODUCTS + INVENTORY
  // ─────────────────────────────────────────
  const productsData = [
    // Smartphones
    { name: 'iPhone 15 Pro',           description: 'Apple iPhone 15 Pro 256GB, chip A17 Pro, camera 48MP',           price: 28990000, imageUrl: 'https://picsum.photos/seed/iphone15pro/400/400',    stock: 100 },
    { name: 'iPhone 14',               description: 'Apple iPhone 14 128GB, chip A15 Bionic',                          price: 19990000, imageUrl: 'https://picsum.photos/seed/iphone14/400/400',       stock: 120 },
    { name: 'Samsung Galaxy S24 Ultra',description: 'Samsung Galaxy S24 Ultra 512GB, S-Pen, camera 200MP',             price: 31990000, imageUrl: 'https://picsum.photos/seed/s24ultra/400/400',       stock: 80  },
    { name: 'Samsung Galaxy A55',      description: 'Samsung Galaxy A55 5G 256GB, màn hình AMOLED 6.6"',               price: 9490000,  imageUrl: 'https://picsum.photos/seed/a55/400/400',            stock: 150 },
    { name: 'Xiaomi 14',               description: 'Xiaomi 14 256GB, Snapdragon 8 Gen 3, Leica camera',               price: 22990000, imageUrl: 'https://picsum.photos/seed/xiaomi14/400/400',       stock: 90  },
    { name: 'OPPO Reno 12 Pro',        description: 'OPPO Reno 12 Pro 256GB, camera AI 50MP, sạc nhanh 80W',           price: 12490000, imageUrl: 'https://picsum.photos/seed/reno12/400/400',         stock: 110 },

    // Laptops & Tablets
    { name: 'MacBook Air M3',          description: 'Apple MacBook Air M3 13-inch 8GB 256GB, mỏng nhẹ',                price: 32990000, imageUrl: 'https://picsum.photos/seed/macbookairm3/400/400',   stock: 50  },
    { name: 'MacBook Pro M3 Pro',      description: 'Apple MacBook Pro M3 Pro 14-inch 18GB 512GB',                     price: 52990000, imageUrl: 'https://picsum.photos/seed/macbookpro/400/400',    stock: 30  },
    { name: 'Dell XPS 15',             description: 'Dell XPS 15 Intel Core i7-13700H 16GB 512GB OLED',                price: 42990000, imageUrl: 'https://picsum.photos/seed/dellxps/400/400',        stock: 40  },
    { name: 'ASUS ZenBook 14 OLED',    description: 'ASUS ZenBook 14 OLED Ryzen 7 7730U 16GB 512GB',                  price: 22990000, imageUrl: 'https://picsum.photos/seed/zenbook/400/400',        stock: 60  },
    { name: 'iPad Air M2',             description: 'Apple iPad Air M2 11-inch 128GB Wi-Fi',                           price: 17990000, imageUrl: 'https://picsum.photos/seed/ipadair/400/400',        stock: 70  },

    // Audio
    { name: 'Sony WH-1000XM5',        description: 'Sony WH-1000XM5 - Tai nghe chống ồn hàng đầu, 30h pin',           price: 7490000,  imageUrl: 'https://picsum.photos/seed/sonywh/400/400',         stock: 200 },
    { name: 'AirPods Pro 2',           description: 'Apple AirPods Pro 2nd Gen, ANC, Transparency mode, MagSafe',      price: 6490000,  imageUrl: 'https://picsum.photos/seed/airpodspro/400/400',     stock: 180 },
    { name: 'Jabra Evolve2 75',        description: 'Jabra Evolve2 75 - Tai nghe văn phòng cao cấp, hybrid ANC',       price: 8990000,  imageUrl: 'https://picsum.photos/seed/jabra/400/400',          stock: 80  },

    // Accessories & Peripherals
    { name: 'Logitech MX Master 3S',   description: 'Logitech MX Master 3S - Chuột không dây, 8K DPI, silent click',  price: 2290000,  imageUrl: 'https://picsum.photos/seed/mxmaster/400/400',       stock: 300 },
    { name: 'Keychron K2 Pro',         description: 'Keychron K2 Pro - Bàn phím cơ không dây, Gateron G Pro Red',     price: 2890000,  imageUrl: 'https://picsum.photos/seed/keychron/400/400',       stock: 250 },
    { name: 'LG 27UK850-W',            description: 'LG 27" 4K UHD IPS Monitor, USB-C 60W, HDR400',                   price: 11990000, imageUrl: 'https://picsum.photos/seed/lgmonitor/400/400',      stock: 60  },
    { name: 'Anker 737 Power Bank',    description: 'Anker 737 Power Bank 24000mAh, sạc nhanh 140W',                  price: 1990000,  imageUrl: 'https://picsum.photos/seed/anker/400/400',          stock: 400 },

    // Smart Home & Wearables
    { name: 'Apple Watch Series 9',    description: 'Apple Watch Series 9 GPS 45mm Midnight Aluminum',                 price: 11990000, imageUrl: 'https://picsum.photos/seed/awseries9/400/400',      stock: 90  },
    { name: 'Xiaomi Smart Band 8 Pro', description: 'Xiaomi Smart Band 8 Pro - AMOLED 1.74", GPS, SpO2, 14 ngày pin',  price: 1290000,  imageUrl: 'https://picsum.photos/seed/miband8/400/400',        stock: 500 },
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
      productId: allProducts[0].id, // iPhone 15 Pro (index 0)
      discountPrice: 24990000,
      maxQty: 5,
      soldQty: 0,
      startAt: new Date(now.getTime() - 60 * 60 * 1000), // 1 giờ trước
      endAt: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 giờ sau
      status: FlashSaleStatus.ACTIVE,
    },
  });

  // Flash sale UPCOMING (sắp diễn ra)
  const flashSaleUpcoming = await prisma.flashSale.create({
    data: {
      productId: allProducts[1].id, // iPhone 14 (index 1)
      discountPrice: 15990000,
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
      productId: allProducts[2].id, // Samsung Galaxy S24 Ultra (index 2)
      discountPrice: 24990000,
      maxQty: 20,
      soldQty: 20,
      startAt: new Date(now.getTime() - 48 * 60 * 60 * 1000), // 2 ngày trước
      endAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),   // hôm qua
      status: FlashSaleStatus.ENDED,
    },
  });

  console.log(`✅ FlashSales: ACTIVE (iPhone 15 Pro), UPCOMING (iPhone 14), ENDED (Samsung Galaxy S24 Ultra)`);

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
