# Feature Specification: FlashDeal — Mini Flash Sale Platform

**Created**: 2026-03-01
**Status**: Draft
**Project path**: `d:\SAP\project\flashdeal\`

---

## Mục lục

1. [Tổng quan hệ thống](#tổng-quan)
2. [Project Structure](#project-structure)
3. [Environment Variables](#environment-variables)
4. [Docker Compose](#docker-compose)
5. [Database Schema](#database-schema)
6. [Prisma Schema](#prisma-schema)
7. [Redis Keys](#redis-keys)
8. [Backend API Spec](#api-specification)
9. [BullMQ Jobs](#bullmq-jobs)
10. [Email Templates](#email-templates)
11. [Error Codes](#error-codes)
12. [Frontend Spec](#frontend-spec)
13. [User Stories & Acceptance Criteria](#user-stories)
14. [Non-functional Requirements](#non-functional-requirements)

---

## Tổng quan hệ thống

FlashDeal là platform bán hàng giảm giá trong thời gian giới hạn. Admin tạo flash sale với số lượng có giới hạn, user mua trong thời gian diễn ra. Hệ thống phải xử lý cạnh tranh (race condition) khi nhiều người cùng mua.

**Actors:**
- **Admin** — quản lý sản phẩm, tạo flash sale, xem tất cả orders
- **User** — đăng ký/đăng nhập, xem flash sale, mua hàng, xem lịch sử đơn

**Core learning goals:**
- Race condition + Distributed Lock (Redis)
- JWT Access + Refresh Token với Redis blacklist
- BullMQ async job processing
- Cache-Aside pattern

---

## Project Structure

```
flashdeal/
├── flashdeal-backend/          # NestJS
│   ├── src/
│   │   ├── main.ts
│   │   ├── app.module.ts
│   │   ├── common/
│   │   │   ├── decorators/
│   │   │   │   ├── public.decorator.ts
│   │   │   │   ├── roles.decorator.ts
│   │   │   │   └── current-user.decorator.ts
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   ├── filters/
│   │   │   │   └── all-exceptions.filter.ts
│   │   │   └── interceptors/
│   │   │       └── response-format.interceptor.ts
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── strategies/
│   │   │   │   │   └── jwt.strategy.ts
│   │   │   │   └── dto/
│   │   │   │       ├── register.dto.ts
│   │   │   │       ├── login.dto.ts
│   │   │   │       └── refresh-token.dto.ts
│   │   │   ├── products/
│   │   │   │   ├── products.module.ts
│   │   │   │   ├── products.controller.ts
│   │   │   │   ├── products.service.ts
│   │   │   │   └── dto/
│   │   │   │       ├── create-product.dto.ts
│   │   │   │       └── update-product.dto.ts
│   │   │   ├── flash-sales/
│   │   │   │   ├── flash-sales.module.ts
│   │   │   │   ├── flash-sales.controller.ts
│   │   │   │   ├── flash-sales.service.ts
│   │   │   │   ├── purchase.service.ts     # Logic mua hàng + lock
│   │   │   │   └── dto/
│   │   │   │       ├── create-flash-sale.dto.ts
│   │   │   │       └── update-flash-sale.dto.ts
│   │   │   ├── orders/
│   │   │   │   ├── orders.module.ts
│   │   │   │   ├── orders.controller.ts
│   │   │   │   └── orders.service.ts
│   │   │   └── queue/
│   │   │       ├── queue.module.ts
│   │   │       ├── processors/
│   │   │       │   └── order.processor.ts
│   │   │       └── jobs/
│   │   │           └── order.job.ts
│   │   └── services/
│   │       ├── prisma.service.ts
│   │       └── redis.service.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   ├── test/
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   └── nest-cli.json
│
├── flashdeal-frontend/         # NextJS
│   ├── src/
│   │   ├── app/                # App Router
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                    # / → redirect to /sales
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx            # /login
│   │   │   │   └── register/
│   │   │   │       └── page.tsx            # /register
│   │   │   ├── (user)/
│   │   │   │   ├── sales/
│   │   │   │   │   ├── page.tsx            # /sales — danh sách flash sales
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx        # /sales/:id — chi tiết sale
│   │   │   │   └── orders/
│   │   │   │       └── page.tsx            # /orders — lịch sử đơn hàng
│   │   │   └── (admin)/
│   │   │       └── admin/
│   │   │           ├── layout.tsx          # Admin layout với sidebar
│   │   │           ├── page.tsx            # /admin — dashboard
│   │   │           ├── products/
│   │   │           │   ├── page.tsx        # /admin/products — danh sách
│   │   │           │   └── [id]/
│   │   │           │       └── page.tsx    # /admin/products/:id — edit
│   │   │           ├── sales/
│   │   │           │   ├── page.tsx        # /admin/sales — danh sách
│   │   │           │   └── new/
│   │   │           │       └── page.tsx    # /admin/sales/new — tạo mới
│   │   │           └── orders/
│   │   │               └── page.tsx        # /admin/orders — tất cả orders
│   │   ├── components/
│   │   │   ├── ui/                         # Reusable UI primitives
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Badge.tsx               # Status badge
│   │   │   │   ├── Spinner.tsx
│   │   │   │   └── Pagination.tsx
│   │   │   ├── flash-sale/
│   │   │   │   ├── SaleCard.tsx            # Card hiển thị 1 flash sale
│   │   │   │   ├── SaleList.tsx            # Grid danh sách
│   │   │   │   ├── CountdownTimer.tsx      # Đếm ngược thời gian
│   │   │   │   └── PurchaseButton.tsx      # Nút mua + trạng thái
│   │   │   ├── order/
│   │   │   │   └── OrderTable.tsx
│   │   │   ├── layout/
│   │   │   │   ├── Navbar.tsx
│   │   │   │   └── AdminSidebar.tsx
│   │   │   └── auth/
│   │   │       └── ProtectedRoute.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useFlashSales.ts
│   │   │   └── useOrders.ts
│   │   ├── services/
│   │   │   ├── api.ts                      # Axios instance + interceptors
│   │   │   ├── auth.service.ts
│   │   │   ├── flash-sale.service.ts
│   │   │   └── order.service.ts
│   │   └── types/
│   │       └── index.ts                    # TypeScript interfaces
│   ├── .env.local
│   ├── package.json
│   └── tailwind.config.ts
│
└── docker-compose.yml
```

---

## Environment Variables

### Backend: `flashdeal-backend/.env`
```env
# App
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL="postgresql://flashdeal:flashdeal123@localhost:5432/flashdeal_db"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Email (MailHog local)
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_FROM=noreply@flashdeal.local

# Rate limiting
RATE_LIMIT_LOGIN_TTL=900        # 15 phút (giây)
RATE_LIMIT_LOGIN_MAX=5          # 5 lần
```

### Frontend: `flashdeal-frontend/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

---

## Docker Compose

File: `docker-compose.yml` (đặt ở root folder)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    container_name: flashdeal_postgres
    environment:
      POSTGRES_USER: flashdeal
      POSTGRES_PASSWORD: flashdeal123
      POSTGRES_DB: flashdeal_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U flashdeal"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: flashdeal_redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: flashdeal_pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@flashdeal.local
      PGADMIN_DEFAULT_PASSWORD: admin123
    ports:
      - "5050:80"
    depends_on:
      - postgres

  mailhog:
    image: mailhog/mailhog:latest
    container_name: flashdeal_mailhog
    ports:
      - "1025:1025"   # SMTP
      - "8025:8025"   # Web UI

volumes:
  postgres_data:
  redis_data:
```

**Khởi động:** `docker-compose up -d`
**pgAdmin:** http://localhost:5050 (admin@flashdeal.local / admin123)
**MailHog:** http://localhost:8025

---

## Database Schema

### `users`
```
id            UUID          PK, default gen_random_uuid()
email         VARCHAR(255)  UNIQUE, NOT NULL
password_hash VARCHAR(255)  NOT NULL
role          ENUM          'ADMIN' | 'USER', default 'USER'
created_at    TIMESTAMP     default now()
updated_at    TIMESTAMP     auto-update
deleted_at    TIMESTAMP     NULL (soft delete)
```

### `products`
```
id             UUID          PK
name           VARCHAR(255)  NOT NULL
description    TEXT          NULL
original_price DECIMAL(10,2) NOT NULL, > 0
image_url      VARCHAR(500)  NULL
created_at     TIMESTAMP
updated_at     TIMESTAMP
deleted_at     TIMESTAMP     NULL (soft delete)
```

### `flash_sales`
```
id             UUID          PK
product_id     UUID          FK → products.id
discount_price DECIMAL(10,2) NOT NULL, > 0
start_at       TIMESTAMP     NOT NULL
end_at         TIMESTAMP     NOT NULL, > start_at
max_qty        INT           NOT NULL, > 0
sold_qty       INT           default 0
status         ENUM          'UPCOMING' | 'ACTIVE' | 'ENDED', default 'UPCOMING'
created_at     TIMESTAMP
updated_at     TIMESTAMP
```

**Business constraints:**
- `discount_price` < `product.original_price`
- `end_at` > `start_at`
- `start_at` > now() khi tạo mới
- `sold_qty` <= `max_qty` (enforced bởi Redis lock)
- Cùng product không có 2 sales overlap về thời gian

### `orders`
```
id             UUID      PK
user_id        UUID      FK → users.id
flash_sale_id  UUID      FK → flash_sales.id
status         ENUM      'PENDING' | 'CONFIRMED' | 'CANCELLED'
created_at     TIMESTAMP
updated_at     TIMESTAMP
```

**Business constraints:**
- Unique: (`user_id`, `flash_sale_id`) where `status != 'CANCELLED'`
  → 1 user chỉ mua 1 lần / flash sale (trừ khi đơn bị cancel)

### `refresh_tokens`
```
id          UUID      PK
user_id     UUID      FK → users.id
token_hash  VARCHAR   NOT NULL  (lưu hash, không lưu raw token)
family      UUID      NOT NULL  (nhóm tokens trong 1 chuỗi rotation)
expires_at  TIMESTAMP NOT NULL
revoked_at  TIMESTAMP NULL
created_at  TIMESTAMP
```
**`family`:** Tất cả tokens sinh ra từ cùng 1 login session dùng chung 1 family UUID.
Khi phát hiện reuse → revoke tất cả tokens cùng family (không ảnh hưởng session khác).

---

## Prisma Schema

File: `flashdeal-backend/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  USER
}

enum FlashSaleStatus {
  UPCOMING
  ACTIVE
  ENDED
}

enum OrderStatus {
  PENDING
  CONFIRMED
  CANCELLED
}

model User {
  id           String    @id @default(uuid())
  email        String    @unique
  passwordHash String    @map("password_hash")
  role         Role      @default(USER)
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  deletedAt    DateTime? @map("deleted_at")

  orders        Order[]
  refreshTokens RefreshToken[]

  @@map("users")
}

model Product {
  id            String    @id @default(uuid())
  name          String
  description   String?
  originalPrice Decimal   @map("original_price") @db.Decimal(10, 2)
  imageUrl      String?   @map("image_url")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  deletedAt     DateTime? @map("deleted_at")

  flashSales FlashSale[]

  @@map("products")
}

model FlashSale {
  id            String          @id @default(uuid())
  productId     String          @map("product_id")
  discountPrice Decimal         @map("discount_price") @db.Decimal(10, 2)
  startAt       DateTime        @map("start_at")
  endAt         DateTime        @map("end_at")
  maxQty        Int             @map("max_qty")
  soldQty       Int             @default(0) @map("sold_qty")
  status        FlashSaleStatus @default(UPCOMING)
  createdAt     DateTime        @default(now()) @map("created_at")
  updatedAt     DateTime        @updatedAt @map("updated_at")

  product Product @relation(fields: [productId], references: [id])
  orders  Order[]

  @@map("flash_sales")
}

model Order {
  id          String      @id @default(uuid())
  userId      String      @map("user_id")
  flashSaleId String      @map("flash_sale_id")
  status      OrderStatus @default(PENDING)
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")

  user      User      @relation(fields: [userId], references: [id])
  flashSale FlashSale @relation(fields: [flashSaleId], references: [id])

  @@map("orders")
}

model RefreshToken {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  tokenHash String    @map("token_hash")
  family    String    @default(uuid())  // Token Family — group cùng 1 session
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@map("refresh_tokens")
}
```

---

## Redis Keys

| Key pattern | Type | TTL | Dùng cho |
|---|---|---|---|
| `inventory:{flashSaleId}` | String (int) | đến hết `end_at` | Số lượng còn lại của sale |
| `lock:purchase:{flashSaleId}` | String | 5s | Distributed lock khi mua |
| `blacklist:token:{jti}` | String | TTL còn lại của access token | Logout blacklist |
| `cache:flash_sales:active` | String (JSON) | 30s | Cache danh sách active sales |
| `cache:flash_sale:{id}` | String (JSON) | 30s | Cache chi tiết 1 sale |

**Lưu ý Redis:**
- **Inventory decrement**: dùng **Lua script** (atomic check + decrement, không cần lock)
- **Inventory key mất** (Redis restart): rebuild từ DB với mutex tránh thundering herd
- **Blacklist JWT**: fail-closed — nếu Redis down thì reject request (bảo mật > availability)
- Không dùng `SET key value NX EX 5` cho purchase flow nữa — Lua script thay thế hoàn toàn

---

## API Specification

### Conventions

**Base URL:** `/api/v1`

**Authenticated routes** cần header:
```
Authorization: Bearer <access_token>
```

**Success Response:**
```json
{ "data": <T> }
{ "data": [...], "meta": { "total": 100, "page": 1, "limit": 20 } }
```

**Error Response:**
```json
{ "error": { "code": "ERROR_CODE", "message": "Human readable" } }
```

---

### Auth

#### `POST /auth/register`
**Access:** Public

**Request:**
```json
{ "email": "user@example.com", "password": "Password123!" }
```
**Validation:**
- `email`: valid format, unique
- `password`: min 8 chars, ít nhất 1 chữ hoa, 1 số

**Success 201:**
```json
{ "data": { "id": "uuid", "email": "user@example.com", "role": "USER" } }
```

**Errors:** `400 VALIDATION_ERROR`, `409 EMAIL_ALREADY_EXISTS`

---

#### `POST /auth/login`
**Access:** Public | Rate limit: 5 req / 15 min / IP

**Request:**
```json
{ "email": "user@example.com", "password": "Password123!" }
```

**Success 200:**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": "uuid", "email": "user@example.com", "role": "USER" }
  }
}
```
**Token specs:**
- Access Token: JWT HS256, TTL=15m, payload=`{ sub, email, role, jti }`
- Refresh Token: JWT HS256, TTL=7d, lưu `bcrypt.hash(token)` vào DB

**Errors:** `401 INVALID_CREDENTIALS`, `429 TOO_MANY_REQUESTS`

---

#### `POST /auth/refresh`
**Access:** Public

**Request:**
```json
{ "refreshToken": "eyJ..." }
```

**Success 200:**
```json
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

**Logic (Refresh Token Rotation + Token Family):**
```
1. Verify JWT signature
2. Tìm token trong DB theo tokenHash
3. Check expired → 401
4. Check revokedAt:
   a. Nếu revokedAt != null:
      - Tính thời gian: now() - revokedAt
      - Nếu < 5 giây (Grace Period) → 401 INVALID_REFRESH_TOKEN (silent, có thể là race)
      - Nếu >= 5 giây → TOKEN REUSE DETECTED:
          * Revoke TẤT CẢ tokens cùng family trong DB
          * Log security event
          * 401 TOKEN_REUSE_DETECTED (có thể gửi email cảnh báo)
5. Revoke token hiện tại (revokedAt = now())
6. Tạo cặp token mới với cùng family UUID
7. Lưu refresh token mới vào DB
8. Return cặp token mới
```

**Grace Period (5s)** giải quyết race condition khi multi-tab browser cùng refresh:
- Tab A refresh → token A revoked, token B issued
- Tab B refresh với token A trong vòng 5s → reject nhẹ nhàng, không nuclear
- Tab B refresh với token A sau 5s → nghi ngờ theft → revoke cả family

**Token Family** đảm bảo:
- Phát hiện theft không ảnh hưởng session khác (thiết bị khác, family khác)
- Chỉ revoke đúng session bị compromise

**Errors:** `401 INVALID_REFRESH_TOKEN`, `401 TOKEN_REUSE_DETECTED`

---

#### `POST /auth/logout`
**Access:** Authenticated

**Request:** Không cần body.

**Logic:**
1. Decode access token lấy `jti` và `exp`
2. `SET blacklist:token:{jti} 1 EX {remaining_seconds}` trong Redis
3. Revoke refresh token trong DB (dùng `userId` từ token)

**Fail-closed behavior (Redis down):**
- Nếu không write được blacklist → **throw error, không cho logout thành công**
- Lý do: tốt hơn là báo lỗi cho user biết, còn hơn là user tưởng đã logout an toàn
- Response: `503 SERVICE_UNAVAILABLE` với message rõ ràng

**JwtAuthGuard với blacklist:**
```typescript
// Fail-closed: nếu Redis down → reject request
try {
  const isBlacklisted = await redis.get(`blacklist:token:${jti}`)
  if (isBlacklisted) throw new UnauthorizedException()
} catch (redisError) {
  // Redis down → fail closed
  throw new ServiceUnavailableException('Auth service unavailable')
}
```

**Success 200:**
```json
{ "data": { "message": "Logged out successfully" } }
```

---

#### `GET /auth/me`
**Access:** Authenticated

**Success 200:**
```json
{ "data": { "id": "uuid", "email": "...", "role": "USER" } }
```

---

### Products (Admin only)

#### `GET /products`
**Query:** `?page=1&limit=20&search=iphone`

**Success 200:** Paginated, bao gồm soft-deleted (admin xem được hết).
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "iPhone 15",
      "description": "...",
      "originalPrice": "25000000.00",
      "imageUrl": "https://...",
      "createdAt": "...",
      "deletedAt": null
    }
  ],
  "meta": { "total": 50, "page": 1, "limit": 20 }
}
```

---

#### `POST /products`
**Request:**
```json
{
  "name": "iPhone 15",
  "description": "Điện thoại Apple",
  "originalPrice": 25000000,
  "imageUrl": "https://example.com/iphone.jpg"
}
```
**Validation:**
- `name`: required, 2-255 chars
- `originalPrice`: required, number > 0
- `imageUrl`: optional, valid URL

**Success 201:** Product object

**Errors:** `400 VALIDATION_ERROR`

---

#### `GET /products/:id`
**Success 200:** Product + thống kê số flash sales.
```json
{
  "data": {
    "id": "uuid",
    "name": "iPhone 15",
    "originalPrice": "25000000.00",
    "flashSalesCount": 3,
    "activeFlashSale": null
  }
}
```
**Errors:** `404 PRODUCT_NOT_FOUND`

---

#### `PATCH /products/:id`
**Request:** Partial — bất kỳ field nào.

**Errors:**
- `404 PRODUCT_NOT_FOUND`
- `409 PRODUCT_HAS_ACTIVE_SALE` — không cho sửa `originalPrice` khi đang có ACTIVE sale

---

#### `DELETE /products/:id`
Soft delete (`deletedAt = now()`).

**Errors:**
- `404 PRODUCT_NOT_FOUND`
- `409 PRODUCT_HAS_UPCOMING_OR_ACTIVE_SALE`

---

### Flash Sales

#### `GET /flash-sales` (Public)
**Query:** `?status=ACTIVE&page=1&limit=20`

`status` filter: `ACTIVE`, `UPCOMING`, `ENDED` (default: ACTIVE + UPCOMING)

Kết quả được **cache Redis 30 giây**.

**Success 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "product": {
        "id": "uuid",
        "name": "iPhone 15",
        "imageUrl": "https://..."
      },
      "originalPrice": "25000000.00",
      "discountPrice": "15000000.00",
      "discountPercent": 40,
      "startAt": "2026-03-01T10:00:00Z",
      "endAt": "2026-03-01T12:00:00Z",
      "maxQty": 100,
      "remainingQty": 57,
      "status": "ACTIVE"
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 20 }
}
```
`remainingQty` lấy từ Redis, fallback DB nếu key không tồn tại.

---

#### `GET /flash-sales/:id` (Public)
Cache 30 giây. Trả về bất kỳ status nào.

**Success 200:** Flash sale object như trên (kèm `remainingQty`).

**Errors:** `404 FLASH_SALE_NOT_FOUND`

---

#### `POST /flash-sales` (Admin)
**Request:**
```json
{
  "productId": "uuid",
  "discountPrice": 15000000,
  "startAt": "2026-03-02T10:00:00Z",
  "endAt": "2026-03-02T12:00:00Z",
  "maxQty": 100
}
```
**Validation:**
- `productId`: tồn tại, chưa soft-deleted
- `discountPrice` > 0 và < `product.originalPrice`
- `startAt` > now()
- `endAt` > `startAt`
- `maxQty` > 0, integer

**Logic sau khi tạo:**
```
SET inventory:{newId} {maxQty}  EX {seconds_until_endAt}
```

**Success 201:** Flash sale object

**Errors:**
- `400 VALIDATION_ERROR`
- `404 PRODUCT_NOT_FOUND`
- `409 PRODUCT_HAS_OVERLAPPING_SALE`

---

#### `PATCH /flash-sales/:id` (Admin)
Chỉ update được khi `status = UPCOMING`.

**Errors:** `409 FLASH_SALE_ALREADY_STARTED`

---

#### `DELETE /flash-sales/:id` (Admin)
Hard delete. Chỉ xóa được khi `status = UPCOMING`.

**Logic:**
- Xóa Redis key `inventory:{id}`
- Xóa record trong DB

**Errors:** `409 FLASH_SALE_ALREADY_STARTED`

---

### Purchase

#### `POST /flash-sales/:id/purchase`
**Access:** Authenticated (role: USER)

**Request:** Không cần body.

**Logic (sequential, toàn bộ trong `PurchaseService`):**
```
1. Find flash sale by id → 404 nếu không tồn tại
2. Check status === ACTIVE → 400 SALE_NOT_ACTIVE
3. Check existing order (non-cancelled) → 409 ALREADY_PURCHASED
4. Ensure inventory key tồn tại (fallback nếu Redis restart):
   - GET inventory:{saleId}
   - Nếu null → acquire rebuild mutex (SET lock:rebuild:{saleId} NX EX 5)
       * Nếu có lock: query DB → remaining = maxQty - soldQty
                              → SET inventory:{saleId} {remaining} EX {ttl_until_endAt}
       * Nếu không có lock (người khác đang rebuild): sleep 200ms → retry từ đầu
5. Chạy Lua script atomic check-and-decrement:
   ```lua
   local inv = redis.call('GET', KEYS[1])
   if not inv or tonumber(inv) <= 0 then return -1 end
   return redis.call('DECR', KEYS[1])
   ```
   → Kết quả -1: 400 SOLD_OUT
   → Kết quả >= 0: tiếp tục
6. prisma.order.create({ userId, flashSaleId, status: PENDING })
   → Nếu DB error: INCR inventory:{saleId}  ← rollback Redis
                    throw InternalServerErrorException
7. Bull.add('order.confirm', { orderId })
8. Return order
```

**Tại sao Lua script tốt hơn Lock+DECR:**
- Không serialize requests qua 1 lock → throughput cao hơn nhiều
- Lua script chạy single-threaded trong Redis → atomic by design
- Không có TTL problem (lock expire sớm khi xử lý chậm)
- Đơn giản hơn: không cần acquire/release lock

**INCR rollback** xử lý case DECR thành công nhưng DB write fail:
- Inventory Redis đã giảm → phải tăng lại để không rò rỉ
- Nếu INCR rollback cũng fail → log alert, manual reconciliation
  (cron job hằng ngày: so sánh `soldQty` DB với `maxQty - inventory` Redis)

**Success 201:**
```json
{
  "data": {
    "id": "uuid",
    "status": "PENDING",
    "flashSale": {
      "id": "uuid",
      "product": { "name": "iPhone 15" },
      "discountPrice": "15000000.00"
    },
    "createdAt": "2026-03-01T10:05:00Z"
  }
}
```

**Errors:**
| Code | HTTP | Khi nào |
|---|---|---|
| `FLASH_SALE_NOT_FOUND` | 404 | Sale không tồn tại |
| `SALE_NOT_ACTIVE` | 400 | Sale chưa/đã kết thúc |
| `ALREADY_PURCHASED` | 409 | User đã mua rồi (non-cancelled order) |
| `SOLD_OUT` | 400 | Redis inventory = 0 (Lua script trả về -1) |
| `SERVICE_UNAVAILABLE` | 503 | Redis down khi cần thiết |

---

### Orders

#### `GET /orders/me`
**Access:** Authenticated

**Query:** `?page=1&limit=20&status=CONFIRMED`

**Success 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "status": "CONFIRMED",
      "flashSale": {
        "id": "uuid",
        "discountPrice": "15000000.00",
        "product": { "name": "iPhone 15", "imageUrl": "..." }
      },
      "createdAt": "..."
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 20 }
}
```

---

#### `GET /orders/:id`
**Access:** Authenticated

User chỉ xem được order của mình. Admin xem được tất cả.

**Success 200:** Order detail.

**Errors:**
- `404 ORDER_NOT_FOUND`
- `403 FORBIDDEN`

---

#### `GET /orders` (Admin only)
**Query:** `?page=1&limit=20&flashSaleId=uuid&userId=uuid&status=CONFIRMED`

**Success 200:** Paginated list tất cả orders.

---

## BullMQ Jobs

### Queue: `orders`

#### Job: `order.confirm`
**Trigger:** Sau khi tạo order PENDING thành công

**Payload:**
```typescript
{ orderId: string }
```

**Processing:**
```
1. Find order by id, include flashSale + product + user
2. Nếu order không tồn tại hoặc status !== PENDING → skip (idempotent)
3. prisma.$transaction([
     order.update({ status: CONFIRMED }),
     flashSale.update({ soldQty: { increment: 1 } })
   ])
4. Gửi email xác nhận tới user.email
5. Log: "Order {id} confirmed"
```

**Config:**
```typescript
{
  attempts: 3,
  backoff: { type: 'fixed', delay: 1000 },
  removeOnComplete: 100,   // giữ lại 100 jobs gần nhất
  removeOnFail: 500
}
```

**On failure sau 3 lần:** Log error, order giữ status PENDING (cron job sẽ cleanup sau — Week 3).

---

## Email Templates

### Order Confirmation Email

**Subject:** `[FlashDeal] Đặt hàng thành công - #{orderId}`

**Body:**
```
Xin chào {user.email},

Đơn hàng của bạn đã được xác nhận!

Sản phẩm: {product.name}
Giá: {discountPrice} VNĐ (giảm {discountPercent}% từ {originalPrice} VNĐ)
Mã đơn hàng: {orderId}
Thời gian đặt: {createdAt}

Cảm ơn bạn đã mua hàng tại FlashDeal!
```

*(Preview tại http://localhost:8025 — MailHog UI)*

---

## Error Codes

Full enum của tất cả error codes trong hệ thống:

```typescript
export enum ErrorCode {
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Auth
  EMAIL_ALREADY_EXISTS   = 'EMAIL_ALREADY_EXISTS',
  INVALID_CREDENTIALS    = 'INVALID_CREDENTIALS',
  INVALID_REFRESH_TOKEN  = 'INVALID_REFRESH_TOKEN',
  UNAUTHORIZED           = 'UNAUTHORIZED',
  FORBIDDEN              = 'FORBIDDEN',
  TOO_MANY_REQUESTS      = 'TOO_MANY_REQUESTS',

  // Products
  PRODUCT_NOT_FOUND                    = 'PRODUCT_NOT_FOUND',
  PRODUCT_HAS_ACTIVE_SALE              = 'PRODUCT_HAS_ACTIVE_SALE',
  PRODUCT_HAS_UPCOMING_OR_ACTIVE_SALE  = 'PRODUCT_HAS_UPCOMING_OR_ACTIVE_SALE',

  // Flash Sales
  FLASH_SALE_NOT_FOUND          = 'FLASH_SALE_NOT_FOUND',
  FLASH_SALE_ALREADY_STARTED    = 'FLASH_SALE_ALREADY_STARTED',
  PRODUCT_HAS_OVERLAPPING_SALE  = 'PRODUCT_HAS_OVERLAPPING_SALE',

  // Purchase
  SALE_NOT_ACTIVE           = 'SALE_NOT_ACTIVE',
  ALREADY_PURCHASED         = 'ALREADY_PURCHASED',
  SOLD_OUT                  = 'SOLD_OUT',

  // Orders
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',

  // Security
  TOKEN_REUSE_DETECTED = 'TOKEN_REUSE_DETECTED',

  // Generic
  INTERNAL_SERVER_ERROR  = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE    = 'SERVICE_UNAVAILABLE',
}
```

---

## Frontend Spec

### TypeScript Types

File: `flashdeal-frontend/src/types/index.ts`
```typescript
export type Role = 'ADMIN' | 'USER'
export type FlashSaleStatus = 'UPCOMING' | 'ACTIVE' | 'ENDED'
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED'

export interface User {
  id: string
  email: string
  role: Role
}

export interface Product {
  id: string
  name: string
  imageUrl: string | null
  originalPrice: string  // Decimal từ Prisma về string
}

export interface FlashSale {
  id: string
  product: Product
  originalPrice: string
  discountPrice: string
  discountPercent: number
  startAt: string        // ISO string
  endAt: string
  maxQty: number
  remainingQty: number
  status: FlashSaleStatus
}

export interface Order {
  id: string
  status: OrderStatus
  flashSale: {
    id: string
    discountPrice: string
    product: Pick<Product, 'name' | 'imageUrl'>
  }
  createdAt: string
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: { total: number; page: number; limit: number }
}
```

---

### Axios Setup

File: `src/services/api.ts`
```
- baseURL = NEXT_PUBLIC_API_URL
- Request interceptor: thêm Authorization: Bearer {accessToken} từ memory
- Response interceptor:
    - Nếu 401 và chưa đang retry:
        1. Gọi POST /auth/refresh với refreshToken từ cookie
        2. Lưu accessToken mới vào memory
        3. Retry request gốc với token mới
    - Nếu refresh thất bại → clear auth state → redirect /login
```

**Token storage:**
- `accessToken`: biến trong memory (trong AuthContext), mất khi reload → dùng refresh flow
- `refreshToken`: httpOnly cookie (set từ backend nếu cần, hoặc dùng localStorage tạm cho học)

> **Note học:** Với mục đích học, có thể lưu cả 2 trong localStorage trước. Sau Week 5 refactor sang httpOnly cookie + memory.

---

### Pages

#### `/sales` — Danh sách Flash Sales (Public)
**Components:** `SaleList` → nhiều `SaleCard`

Mỗi `SaleCard` hiển thị:
- Ảnh sản phẩm
- Tên sản phẩm
- Giá gốc (gạch ngang) + Giá sale + % giảm
- Progress bar: `remainingQty / maxQty`
- `CountdownTimer`: đếm ngược đến `endAt` (nếu ACTIVE) hoặc `startAt` (nếu UPCOMING)
- Badge status: ACTIVE (xanh) / UPCOMING (vàng) / ENDED (xám)
- Nút "Xem chi tiết"

**Data fetching:** `useFlashSales()` hook dùng `fetch` với `revalidate: 30` (Next.js ISR) hoặc TanStack Query với `staleTime: 30000`.

---

#### `/sales/:id` — Chi tiết Flash Sale (Public)
**Components:** Detail card + `PurchaseButton`

Hiển thị:
- Tất cả thông tin như SaleCard nhưng đầy đủ hơn
- Description của sản phẩm
- `CountdownTimer` lớn hơn
- `PurchaseButton`:
  - Chưa đăng nhập → "Đăng nhập để mua"
  - UPCOMING → disabled "Chưa mở bán"
  - ENDED → disabled "Đã kết thúc"
  - ACTIVE + còn hàng → "Mua ngay" (enabled)
  - ACTIVE + hết hàng → disabled "Hết hàng"
  - Đã mua rồi → disabled "Đã mua"
  - Loading state khi đang call API

---

#### `/login` — Trang đăng nhập (Guest only)
Form: email + password + nút "Đăng nhập"
- Validation client-side trước khi submit
- Hiển thị error message từ API
- Sau đăng nhập thành công → redirect về trang trước hoặc `/sales`

---

#### `/register` — Trang đăng ký (Guest only)
Form: email + password + confirm password
- `password === confirmPassword` validate client-side

---

#### `/orders` — Lịch sử đơn hàng (Cần đăng nhập)
**Components:** `OrderTable`

Cột: Sản phẩm | Giá | Trạng thái (badge) | Ngày đặt

Filter by status: Tất cả / PENDING / CONFIRMED / CANCELLED

---

#### `/admin` — Admin Dashboard (Admin only)
Thống kê đơn giản:
- Số sản phẩm
- Số flash sales (đang active)
- Số orders hôm nay

---

#### `/admin/products` — Quản lý sản phẩm
Table: Tên | Giá gốc | Actions (Sửa / Xóa)
Nút "Thêm sản phẩm" → mở modal form

---

#### `/admin/sales` — Quản lý Flash Sales
Table: Sản phẩm | Giá sale | Thời gian | Số lượng | Status | Actions
Nút "Tạo Flash Sale" → `/admin/sales/new`

---

#### `/admin/orders` — Tất cả orders (Admin)
Table: User | Sản phẩm | Trạng thái | Thời gian
Filter by status + flashSaleId

---

### AuthContext

```typescript
interface AuthContextType {
  user: User | null
  accessToken: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshAccessToken: () => Promise<string | null>
}
```

**Initial load:** Khi app khởi động, gọi `GET /auth/me` với refresh token để khôi phục session.

---

## User Stories & Acceptance Criteria

### Story 0: Auth (P0)

**[S0-1] Đăng ký thành công**
- Given: email chưa tồn tại
- When: POST /auth/register với valid data
- Then: 201, user object (không có password_hash)

**[S0-2] Đăng nhập thành công**
- Given: user đã đăng ký
- When: POST /auth/login với đúng credentials
- Then: 200, accessToken (15m) + refreshToken (7d) + user info

**[S0-3] Logout vô hiệu hóa token ngay lập tức**
- Given: user có valid access token
- When: POST /auth/logout, sau đó dùng token đó gọi API khác
- Then: 401 UNAUTHORIZED (token bị blacklist trong Redis)

**[S0-4] Refresh Token Rotation**
- Given: user có valid refresh token
- When: POST /auth/refresh
- Then: nhận token mới; refresh token cũ không dùng được nữa (409 INVALID_REFRESH_TOKEN)

**[S0-5] Rate limit đăng nhập**
- When: đăng nhập sai 5 lần liên tiếp từ cùng IP trong 15 phút
- Then: lần thứ 6 nhận 429 TOO_MANY_REQUESTS

---

### Story 1: Admin quản lý Flash Sale (P1)

**[S1-1] Tạo flash sale hợp lệ**
- Given: admin login, product tồn tại
- When: POST /flash-sales với discountPrice < originalPrice, startAt > now
- Then: 201, Redis key `inventory:{id}` = maxQty

**[S1-2] Không tạo khi discount >= original**
- When: discountPrice = originalPrice
- Then: 400 VALIDATION_ERROR

**[S1-3] Không tạo khi overlap time**
- Given: product A có sale từ 10h-12h
- When: tạo sale cho product A từ 11h-13h
- Then: 409 PRODUCT_HAS_OVERLAPPING_SALE

**[S1-4] Không xóa sale đang active**
- Given: flash sale đang ACTIVE
- When: DELETE /flash-sales/:id
- Then: 409 FLASH_SALE_ALREADY_STARTED

---

### Story 2: User mua hàng (P1)

**[S2-1] Mua thành công**
- Given: sale ACTIVE, còn hàng, user chưa mua
- When: POST /flash-sales/:id/purchase
- Then: 201, order PENDING; sau BullMQ job → CONFIRMED; email được gửi

**[S2-2] Hết hàng**
- Given: Redis inventory = 0
- When: purchase
- Then: 400 SOLD_OUT

**[S2-3] Không mua 2 lần**
- Given: user đã có order CONFIRMED
- When: purchase lần 2
- Then: 409 ALREADY_PURCHASED

**[S2-4] Mua lại được sau cancel**
- Given: user có order CANCELLED, sale còn hàng
- When: purchase
- Then: 201, order mới

---

### Story 3: Race condition — 100 users đồng thời (P0 — core learning)

**[S3-1] Inventory không âm**
- Given: flash sale maxQty = 10, inventory Redis = 10
- When: 100 concurrent POST /flash-sales/:id/purchase
- Then:
  - Đúng 10 orders CONFIRMED
  - inventory Redis = 0, không bao giờ < 0
  - 90 requests còn lại nhận 400 SOLD_OUT hoặc 429

**Test tool:** `autocannon` hoặc `k6`
```bash
# Dùng autocannon
npx autocannon -c 100 -d 5 -m POST \
  -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/v1/flash-sales/{id}/purchase
```

---

### Story 4: User xem lịch sử đơn hàng (P2)

**[S4-1] Xem orders của mình**
- Given: user đã có 3 orders
- When: GET /orders/me
- Then: 200, 3 orders với product info

**[S4-2] Không xem orders của người khác**
- Given: order của user A
- When: user B GET /orders/{orderId của A}
- Then: 403 FORBIDDEN

---

## Non-functional Requirements

| Yêu cầu | Target |
|---|---|
| Purchase API response time (p95) | < 200ms |
| Concurrent purchase (race condition safe) | 100 req/s |
| Redis blacklist check latency | < 5ms |
| Active sales cache TTL | 30s |
| BullMQ job retry | 3 lần, delay 1s |
| Login rate limit | 5 attempts / 15 min / IP |
| API pagination default limit | 20 items |

---

## Out of scope (implement đúng tuần)

| Tính năng | Tuần implement |
|---|---|
| SSE real-time countdown | Week 3 |
| Elasticsearch product search | Week 13 |
| Prometheus + Grafana monitoring | Week 12 |
| Docker multi-stage build tối ưu | Week 9 |
| CI/CD GitHub Actions | Week 10 |
| OWASP security audit | Week 15 |
| Load testing với k6 | Week 16 |
