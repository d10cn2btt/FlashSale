# Backend Troubleshoot Log

> Ghi lại các lỗi thực tế gặp phải khi dev. Format: Lỗi → Nguyên nhân → Solution → Why.

---

## [BK-001] Port vẫn là 3000 dù đã set PORT=5000 trong .env

**Ngày:** 2026-03-01  
**Tuần:** Week 1 / Day 1  
**Triệu chứng:**
```
Error: listen EADDRINUSE: address already in use :::3000
```
Dù file `.env` đã có `PORT=5000`, backend vẫn cố bind vào port 3000.

---

### Nguyên nhân

NestJS **không tự động đọc file `.env`**. `process.env.PORT` là `undefined` lúc `main.ts` chạy, nên expression:

```typescript
await app.listen(process.env.PORT ?? 3000);
// undefined ?? 3000  →  fallback về 3000
```

`@nestjs/config` (wrapper của `dotenv`) chưa được cài, nên không có gì load `.env` vào `process.env` cả.

---

### Solution

**Bước 1:** Cài package
```bash
cd backend
npm install @nestjs/config
```

**Bước 2:** Load `ConfigModule` trong `AppModule` để dotenv chạy sớm nhất có thể:
```typescript
// app.module.ts
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // inject ConfigService ở mọi nơi không cần re-import
    }),
  ],
})
export class AppModule {}
```

**Bước 3:** `main.ts` giờ đọc đúng:
```typescript
const port = process.env.PORT ?? 3000;
await app.listen(port);
console.log(`Server running on http://localhost:${port}`);
```

---

### Why — Hiểu sâu hơn

| Câu hỏi | Giải thích |
|---|---|
| Tại sao NestJS không tự đọc `.env`? | NestJS là framework thuần JS/TS, không giả định bạn dùng file `.env`. Đó là trách nhiệm của `dotenv` / `@nestjs/config`. |
| `ConfigModule.forRoot()` làm gì? | Gọi `dotenv.config()` nội bộ, load `.env` vào `process.env` ngay khi module được khởi tạo. |
| Tại sao `isGlobal: true`? | Mặc định NestJS DI là module-scoped. Nếu không `isGlobal`, mỗi module (AuthModule, UserModule...) phải import `ConfigModule` lại. `isGlobal` giúp inject `ConfigService` ở bất kỳ đâu. |
| So sánh với Laravel? | Laravel tự load `.env` qua `Dotenv` trong `bootstrap/app.php` — bạn không cần làm gì. NestJS yêu cầu explicit hơn. |

---

### Lesson learned

> Khi chuyển từ Laravel sang NestJS: đừng assume framework tự làm thứ gì. NestJS explicit hơn Laravel rất nhiều — đó là điểm mạnh (kiểm soát được), nhưng cũng là bẫy với người mới.

---

## [BK-002] pgAdmin không start — email `.local` không hợp lệ

**Ngày:** 2026-03-01  
**Tuần:** Week 1 / Day 1  
**Triệu chứng:**
```
'admin@flashdeal.local' does not appear to be a valid email address.
Please reset the PGADMIN_DEFAULT_EMAIL environment variable and try again.
```
Container `flashdeal_pgadmin` liên tục `Exited (1)`.

---

### Nguyên nhân

pgAdmin4 phiên bản mới (image `latest`) thêm **strict email validation**. Domain `.local` bị từ chối vì là reserved/special-use domain theo RFC, không phải domain internet hợp lệ.

---

### Solution

Đổi email trong `docker-compose.yml` sang domain hợp lệ:

```yaml
# trước
PGADMIN_DEFAULT_EMAIL: admin@flashdeal.local

# sau
PGADMIN_DEFAULT_EMAIL: admin@flashdeal.com
```

Sau đó restart container:
```bash
docker-compose up -d pgadmin
```

---

### Why

pgAdmin dùng thư viện email validation kiểm tra deliverability. Domain `.local` là special-use (RFC 6762 — mDNS/Bonjour), bị reject. Dùng `.com`, `.dev` hoặc bất kỳ domain thật nào là được — đây chỉ là credentials local, không gửi email thật.

---

## [BK-003] Prisma v7 — `url` không còn được khai báo trong `schema.prisma`

**Ngày:** 2026-03-01  
**Tuần:** Week 1 / Day 1  
**Triệu chứng:**
```
error: The datasource property `url` is no longer supported in schema files.
Move connection URLs for Migrate to `prisma.config.ts`
```

---

### Nguyên nhân

**Prisma v7 breaking change**: `DATABASE_URL` không còn khai báo trong `datasource db {}` của `schema.prisma`. Thay vào đó, connection URL được quản lý tập trung trong `prisma.config.ts`.

---

### Solution

Xóa dòng `url` khỏi `schema.prisma`:

```prisma
# trước
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

# sau
datasource db {
  provider = "postgresql"
}
```

`prisma.config.ts` đã handle connection URL:

```typescript
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
```

---

### Why

| Prisma v5 (cũ) | Prisma v7 (mới) |
|---|---|
| `url = env("DATABASE_URL")` trong `schema.prisma` | `url` trong `prisma.config.ts` |
| Không có `prisma.config.ts` | `prisma.config.ts` là config trung tâm cho CLI |

Prisma tách "schema definition" (models, relations) khỏi "runtime config" (connection, migrations path). `schema.prisma` chỉ còn chứa models.

---

## [BK-004] `prisma migrate dev` lỗi authentication — port 5432 bị conflict với PostgreSQL local

**Ngày:** 2026-03-01  
**Tuần:** Week 1 / Day 1  
**Triệu chứng:**
```
Error: P1000: Authentication failed against database server,
the provided database credentials for `flashdeal` are not valid.
```

---

### Nguyên nhân

Máy đã có **PostgreSQL cài sẵn** đang chạy trên port 5432. Khi Docker map `5432:5432`, cả 2 cùng lắng nghe — Prisma CLI connect vào PostgreSQL local của máy (sai credentials) thay vì Docker container.

```
netstat -ano | grep :5432
→ 2 process cùng dùng port 5432:
  - postgres.exe     (local install — PID 5792)
  - com.docker.backend.exe (Docker — PID 10940)
```

---

### Solution

**Option 1 (đang dùng):** Tắt PostgreSQL service local trên Windows:
```bash
net stop postgresql-x64-17   # tên service tùy version
```

**Option 2:** Đổi port Docker trong `docker-compose.yml`:
```yaml
ports:
  - "5433:5432"
```
Và cập nhật `DATABASE_URL` trong `.env`:
```
DATABASE_URL="postgresql://flashdeal:flashdeal123@localhost:5433/flashdeal_db"
```

---

### Why

Docker port mapping `HOST:CONTAINER` — khi 2 process cùng bind `0.0.0.0:5432` trên host, Prisma CLI (chạy trên host) hit vào process nào thắng race. PostgreSQL local thắng → credentials sai → P1000.

> Lesson: Luôn kiểm tra port conflict khi dùng Docker với services phổ biến (5432, 3306, 6379, 27017).

---

## [BK-005] `prisma.config.ts` dùng `dotenv/config` nhưng package chưa install

**Ngày:** 2026-03-01  
**Tuần:** Week 1 / Day 1  
**Triệu chứng:**

`DATABASE_URL` là `undefined` khi Prisma CLI chạy dù file `.env` đúng → lỗi P1000 authentication.

---

### Nguyên nhân

`prisma.config.ts` có dòng `import "dotenv/config"` nhưng package `dotenv` chưa có trong `package.json`. `@nestjs/config` không có tác dụng ở đây vì Prisma CLI chạy độc lập với NestJS.

---

### Solution

```bash
cd backend
npm install dotenv
```

---

### Why

| | Dùng được ở đâu |
|---|---|
| `@nestjs/config` / `ConfigModule` | Chỉ khi NestJS app đang chạy (runtime) |
| `dotenv` | Bất kỳ đâu — CLI tools, scripts, test runners |

`prisma migrate` là CLI tool, chạy trước khi NestJS boot. Phải dùng `dotenv` thuần để load `.env` vào `process.env`.

---

## [BK-012] Prisma v7 `prisma-client` generator — `exports is not defined in ES module scope` khi start NestJS

**Ngày:** 2026-03-02
**Tuần:** Week 1 / Day 3
**Triệu chứng:**
```
ReferenceError: exports is not defined in ES module scope
    at dist/generated/prisma/client.js:38
```
Xảy ra khi chạy `npm run start:dev`.

### Nguyên nhân
Prisma v7 generator mới (`prisma-client`) generate ra **TypeScript source files** trong `generated/prisma/`. Các file này dùng `@prisma/client/runtime/client` — đây là ESM-only runtime. Khi NestJS compile sang CJS, xảy ra conflict:
1. `generated/prisma/client.ts` import từ `@prisma/client/runtime/client` (ESM)
2. NestJS compile → `dist/generated/prisma/client.js` (CJS)
3. Runtime: CJS file (`exports`) bị Node.js load như ESM → `exports is not defined`

Đổi tsconfig sang commonjs không fix được vì runtime conflict nằm ở Prisma internal, không phải TypeScript output.

### Solution
Dùng generator cũ `prisma-client-js` thay vì `prisma-client` mới:

**`prisma/schema.prisma`:**
```prisma
// Sai (new generator, ESM conflict)
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

// Đúng (old generator, pre-compiled CJS trong node_modules)
generator client {
  provider = "prisma-client-js"
}
```

Sau đó:
```bash
rm -rf generated/      # xóa thư mục generated cũ
rm -rf dist tsconfig.tsbuildinfo  # xóa cache
npx prisma generate    # generate vào node_modules/@prisma/client
```

Import thay đổi:
```typescript
// Từ (generated path)
import { PrismaClient } from '../generated/prisma/client';

// Sang (node_modules)
import { PrismaClient } from '@prisma/client';
```

**Lưu ý:** Prisma v7 vẫn bắt buộc adapter dù dùng generator nào:
```typescript
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```

### Why
- `prisma-client` (mới): generate TypeScript source files → cần compile → ESM runtime conflict với NestJS CJS
- `prisma-client-js` (cũ): generate pre-compiled CJS files vào `node_modules` → NestJS import trực tiếp → không conflict
- `prisma-client` là tương lai của Prisma nhưng chưa tương thích tốt với NestJS CJS stack (phù hợp Phase 2+ khi hiểu sâu hơn)

---

## [BK-006] Prisma v7 — `PrismaClient` bắt buộc phải truyền driver adapter

**Ngày:** 2026-03-02
**Tuần:** Week 1 / Day 2
**Triệu chứng:**
```
Expected 1 arguments, but got 0.
```
`new PrismaClient()` không nhận 0 argument như Prisma v5.

### Nguyên nhân
Prisma v7 với generator `prisma-client` (mới) thay đổi hoàn toàn cách kết nối: thay vì tự đọc `DATABASE_URL` từ env, bắt buộc truyền **Driver Adapter** vào constructor. `PrismaClientOptions` là union type — bắt buộc có `adapter` hoặc `accelerateUrl`.

### Solution
1. Cài package: `npm install @prisma/adapter-pg pg && npm install -D @types/pg`
2. Cập nhật `PrismaService`:
```typescript
import { PrismaPg } from '@prisma/adapter-pg';

constructor() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  super({ adapter });
}
```
3. Tương tự với `seed.ts` — tạo adapter ở module level sau khi load dotenv.

### Why
Prisma v7 tách biệt hoàn toàn runtime engine khỏi database driver, cho phép dùng nhiều loại adapter khác nhau (serverless, edge, etc.). Đây là hướng kiến trúc mới của Prisma.

---

## [BK-007] `seed.ts` — Cannot find module `'../generated/prisma'`

**Ngày:** 2026-03-02
**Tuần:** Week 1 / Day 2
**Triệu chứng:**
```
Cannot find module '../generated/prisma' or its corresponding type declarations.
```

### Nguyên nhân
Prisma v7 generate ra các file riêng lẻ, không có `index.ts` ở root `generated/prisma/`. `PrismaClient` nằm trong `client.ts`, enums nằm trong `enums.ts`.

### Solution
```typescript
// Sai
import { PrismaClient, Role } from '../generated/prisma';

// Đúng
import { PrismaClient } from '../generated/prisma/client';
import { Role, FlashSaleStatus, OrderStatus } from '../generated/prisma/enums';
```

### Why
Generator mới của Prisma v7 tổ chức output theo nhiều file để tree-shaking tốt hơn, không bundle tất cả vào một entry point.

---

## [BK-008] `prisma db seed` — seed command lỗi `no seed command configured`

**Ngày:** 2026-03-02
**Tuần:** Week 1 / Day 2
**Triệu chứng:**
```
No seed command configured
To seed your database, add a seed property to the migrations section in your Prisma config file.
```

### Nguyên nhân
Prisma v7 đọc seed config từ `prisma.config.ts`, không còn đọc từ `package.json > prisma > seed` nữa.

### Solution
Thêm vào `prisma.config.ts`:
```typescript
migrations: {
  path: "prisma/migrations",
  seed: "tsx prisma/seed.ts",   // string thẳng, không phải object
},
```

**Lưu ý:** Giá trị là `string` thẳng, không phải `{ run: "..." }` — TypeScript sẽ báo lỗi nếu dùng object.

### Why
Prisma v7 centralize tất cả config vào `prisma.config.ts` thay vì phân tán sang `package.json`.

---

## [BK-009] `prisma db seed` — `ReferenceError: exports is not defined in ES module scope`

**Ngày:** 2026-03-02
**Tuần:** Week 1 / Day 2
**Triệu chứng:**
```
ReferenceError: exports is not defined in ES module scope
```
Xảy ra khi seed command dùng `ts-node --compiler-options {"module":"CommonJS"}`.

### Nguyên nhân
`tsconfig.json` cấu hình `"module": "nodenext"` (ESM). Ép `ts-node` compile sang CommonJS nhưng runtime vẫn là ESM — conflict.

### Solution
Dùng `tsx` thay vì `ts-node`:
```bash
npm install --save-dev tsx
```
Seed command: `tsx prisma/seed.ts` (không cần flag `--compiler-options`).

### Why
`tsx` tự detect module system và handle cả ESM lẫn CJS, phù hợp hơn với project dùng `nodenext`.

---

## [BK-010] `prisma db seed` — `ECONNREFUSED` do thiếu file `.env`

**Ngày:** 2026-03-02
**Tuần:** Week 1 / Day 2
**Triệu chứng:**
```
PrismaClientKnownRequestError: code: 'ECONNREFUSED'
```
`seed.ts` không kết nối được DB dù Docker đang chạy.

### Nguyên nhân
File `.env` chưa được tạo — chỉ có `.env.example`. `seed.ts` dùng `import 'dotenv/config'` nên cần file `.env` thật sự tồn tại. `DATABASE_URL` là `undefined` → adapter khởi tạo với connection string rỗng.

### Solution
```bash
cp .env.example .env
```
File `.env` phải được tạo trước khi chạy bất kỳ Prisma command nào.

### Why
`.env.example` chỉ là template để commit lên git (không chứa secret thật). `.env` là file thật dùng local, thường bị `.gitignore`.

---

## [BK-011] Sau khi `docker compose down && up` — migration mất, seed lỗi table not found

**Ngày:** 2026-03-02
**Tuần:** Week 1 / Day 2
**Triệu chứng:**
```
P2021: The table 'public.orders' does not exist in the current database.
```

### Nguyên nhân
`docker compose down` xóa container nhưng **volume vẫn còn** (nếu không dùng `-v`). Tuy nhiên khi container mới start, migration state trong DB được giữ lại qua volume. Lỗi này xảy ra vì **trước đó chưa chạy migrate lần nào** (do ECONNREFUSED ở BK-010 ngăn cản).

### Solution
Chạy migrate trước khi seed:
```bash
npx prisma migrate deploy   # apply tất cả migration files lên DB
npx prisma db seed          # sau đó mới seed
```

### Why
- `migrate deploy`: áp dụng migration files đã có vào DB (dùng cho production/staging).
- `migrate dev`: tạo migration mới + áp dụng (dùng khi đang phát triển, thay đổi schema).
- Seed chỉ insert data, không tạo tables — tables phải được tạo bởi migration trước.

---

## [BK-012] `npx prisma db seed` lỗi `Cannot find module '.prisma/client/default'`

**Ngày:** 2026-03-02
**Tuần:** Week 1 / Day 3
**Triệu chứng:**
```
Error: Cannot find module '.prisma/client/default'
Require stack:
- node_modules\@prisma\client\default.js
- backend\prisma\seed.ts
```

### Nguyên nhân
`@prisma/client` không phải là thư viện tĩnh được cài qua `npm install`. Nó được **generate** ra từ `schema.prisma` vào `node_modules/.prisma/client/`. File này **không được commit vào git** (nằm trong `.gitignore`).

Khi chuyển máy / clone repo mới → folder `.prisma/client/` không tồn tại → seed/app không tìm thấy client.

### Solution
```bash
npx prisma generate   # generate Prisma Client từ schema
npx prisma db seed    # sau đó mới seed được
```

### Why
Prisma generate ra code TypeScript/JS tương ứng với schema của mày (types, query builders...). Đây là **code generation**, không phải download package. Mỗi lần thay đổi `schema.prisma` cũng cần chạy lại `prisma generate`.

**Thứ tự chuẩn khi setup máy mới:**
```
1. npm install
2. npx prisma generate        ← tạo Prisma Client
3. npx prisma migrate deploy  ← tạo tables trong DB
4. npx prisma db seed         ← insert data
```

---

