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

