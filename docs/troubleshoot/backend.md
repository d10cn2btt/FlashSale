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

