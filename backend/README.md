# FlashDeal — Backend

> NestJS backend cho Mini Flash Sale Platform.
> Tài liệu này tổng hợp tech stack, cách chạy project, và các concept quan trọng đã học.

---

## Tech Stack

| Layer | Công nghệ | Phiên bản | Ghi chú |
|---|---|---|---|
| **Framework** | NestJS | v11 | Modular, DI container, decorator-based |
| **Language** | TypeScript | v5.7 | `module: nodenext` (ESM) |
| **ORM** | Prisma | v7 | Driver Adapter pattern (`@prisma/adapter-pg`) |
| **Database** | PostgreSQL | v15 | Chạy trong Docker |
| **Cache / Lock** | Redis | latest | Cache + Distributed Lock + Pub/Sub (Phase 2+) |
| **Queue** | BullMQ | Phase 3+ | Chạy trên Redis |
| **Auth** | JWT + Refresh Token | — | Access 15m, Refresh 7d, Redis blacklist |
| **Validation** | class-validator + class-transformer | — | Validate DTO tại Controller layer |
| **Runtime executor** | tsx | — | Thay ts-node, hỗ trợ ESM |
| **Container** | Docker Compose | — | PostgreSQL, Redis, pgAdmin, MailHog |

### Conventions
- **Error format:** `{ error: { code: string, message: string } }`
- **Success format:** `{ data: T }` hoặc `{ data: T[], meta: { total, page } }`
- **API prefix:** `/api/v1/`
- **Auth:** Bearer JWT trong `Authorization` header
- **Soft delete:** field `deletedAt` timestamp (không xóa vật lý)
- **All tables có:** `createdAt`, `updatedAt`

---

## Chạy local

### Yêu cầu
- Docker Desktop
- Node.js v22+
- npm

### Setup lần đầu

```bash
# 1. Copy env
cp .env.example .env

# 2. Start Docker services (PostgreSQL, Redis, pgAdmin, MailHog)
cd .. && docker compose up -d

# 3. Cài dependencies
cd backend && npm install

# 4. Chạy migration (tạo tables)
npx prisma migrate deploy

# 5. Seed data mẫu
npx prisma db seed

# 6. Start dev server
npm run start:dev
```

### Services sau khi start

| Service | URL | Thông tin |
|---|---|---|
| API Backend | http://localhost:5000 | NestJS |
| pgAdmin | http://localhost:5050 | admin@flashdeal.local / admin |
| MailHog | http://localhost:8025 | Fake SMTP UI |
| Redis | localhost:6379 | — |

### Seed accounts (password: `Password123!`)

| Email | Role |
|---|---|
| admin@flashdeal.com | ADMIN |
| alice@example.com | CUSTOMER |
| bob@example.com | CUSTOMER |
| charlie@example.com | CUSTOMER |

---

## Prisma — Ghi chú quan trọng

**Prisma v7 dùng Driver Adapter pattern** — khác hoàn toàn v5:

```typescript
// v5 (cũ): tự đọc DATABASE_URL
const prisma = new PrismaClient();

// v7 (mới): bắt buộc truyền adapter
import { PrismaPg } from '@prisma/adapter-pg';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```

**Prisma type vs DTO:**
- Prisma type = mirror của DB schema (có `id`, `passwordHash`, `deletedAt`...)
- DTO = input từ client (chỉ có những gì client được phép gửi, có validation rules)

---

## Concepts học được

### Q: Tại sao dùng bcrypt thay vì MD5/SHA256 để hash password?

**A:** MD5/SHA256 được thiết kế để **nhanh** — hash file lớn trong milliseconds. Attacker có thể brute-force hàng tỷ hash/giây bằng GPU.

bcrypt được thiết kế để **chậm có chủ ý** — có `cost factor` (default 10-12), mỗi lần hash mất ~100ms. Attacker chỉ thử được ~10 lần/giây. Cùng một password list: crack bằng MD5 mất vài giây, bcrypt mất hàng nghìn năm.

```typescript
const hash = await bcrypt.hash('Password123!', 10); // cost factor = 10
const isValid = await bcrypt.compare(inputPassword, hash);
```

### Q: Tại sao JWT cần 2 token (Access + Refresh) thay vì 1?

**A:** Đây là đánh đổi giữa **security** và **UX**:

| | 1 token dài hạn (7 ngày) | 1 token ngắn hạn (15 phút) | 2 token |
|---|---|---|---|
| UX | Tốt — không cần login lại | Tệ — login lại mỗi 15 phút | Tốt |
| Bị đánh cắp | Nguy hiểm — attacker có 7 ngày | Ít nguy hiểm — tối đa 15 phút | An toàn |
| Revoke được không? | Phải lưu DB (stateful) | Không cần | Refresh Token lưu DB → revokable |

**Flow:**
1. Login → nhận Access Token (15m, stateless) + Refresh Token (7d, lưu DB)
2. Mỗi request → gửi Access Token
3. Access Token hết hạn → dùng Refresh Token để lấy cặp token mới (rotate)
4. Logout → xóa Refresh Token khỏi DB → không thể refresh nữa

JWT Access Token là **stateless** — server không lưu gì, không thể revoke trước hạn. Đó là lý do sống ngắn (15 phút). Refresh Token là **stateful** — lưu DB, revoke bất cứ lúc nào.

---

## Cấu trúc thư mục

```
src/
├── app.module.ts           # Root module
├── main.ts                 # Bootstrap
├── common/
│   └── prisma/
│       ├── prisma.module.ts   # @Global() — import 1 lần, dùng mọi nơi
│       └── prisma.service.ts  # Extends PrismaClient, lifecycle hooks
└── modules/
    ├── user/
    │   ├── user.module.ts
    │   ├── user.controller.ts
    │   └── user.service.ts
    └── auth/               # Week 1 Day 3+
        ├── auth.module.ts
        ├── auth.controller.ts
        ├── auth.service.ts
        └── dto/
            ├── register.dto.ts
            └── login.dto.ts
```
