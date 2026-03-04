# NestJS — Kỹ thuật & Ghi chú

> Ghi lại các kỹ thuật NestJS học được trong quá trình làm FlashDeal.
> Format: Kỹ thuật → Giải thích → Code ví dụ → Khi nào dùng.

---

## [NS-001] `cookie-parser` middleware — Đọc cookie trong NestJS

**Tuần:** Week 1 / Day 6

### Vấn đề

NestJS không tự parse `Cookie` header. Nếu truy cập `req.cookies`, sẽ nhận `undefined`.

### Setup

```bash
npm install cookie-parser
npm install -D @types/cookie-parser
```

```ts
// main.ts
import cookieParser from 'cookie-parser'; // default import — package là CJS

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser()); // ← TRƯỚC app.listen()

  await app.listen(3000);
}
```

> ⚠️ Phải đặt `app.use(cookieParser())` **trước** `app.listen()`. Sau `listen()` thì middleware không có tác dụng.

### Dùng trong controller

```ts
import { Req } from '@nestjs/common';
import { Request } from 'express';

async refresh(@Req() req: Request) {
  const refreshToken = req.cookies['refreshToken']; // ✓
}
```

---

## [NS-002] `@Res({ passthrough: true })` — Set cookie/header mà không mất NestJS serialization

**Tuần:** Week 1 / Day 6

### Vấn đề

Khi cần access `res` object để set cookie, nếu dùng `@Res()` thông thường → NestJS nhường quyền control cho mày hoàn toàn → phải gọi `res.json()` thủ công, mất auto-serialization.

### `passthrough: true` giải quyết

```ts
import { Res } from '@nestjs/common';
import { Response } from 'express'; // ← phải import từ 'express', không phải Web API

async login(
  @Body() dto: LoginDto,
  @Res({ passthrough: true }) res: Response, // ← passthrough
) {
  const { accessToken, refreshToken } = await this.authService.login(dto);

  // Set httpOnly cookie
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,       // JS không đọc được → chống XSS
    sameSite: 'strict',   // chỉ gửi cùng domain → chống CSRF
    maxAge: 7 * 24 * 60 * 60 * 1000, // milliseconds
    path: '/api/v1/auth', // cookie chỉ gửi đến /auth/* endpoints
    // secure: true,      // ← bật khi production (chỉ HTTPS)
  });

  return { data: { accessToken } }; // ← NestJS vẫn tự serialize bình thường ✓
}
```

### So sánh `@Res()` vs `@Res({ passthrough: true })`

| | `@Res()` | `@Res({ passthrough: true })` |
|---|---|---|
| NestJS serialization | ❌ Tắt — phải gọi `res.json()` thủ công | ✓ Vẫn hoạt động |
| Interceptors/Filters | ❌ Bỏ qua | ✓ Vẫn chạy |
| Dùng khi | Download file, custom response hoàn toàn | Set cookie/header, redirect nhỏ |

---

## [NS-003] httpOnly Cookie cho Refresh Token — Pattern bảo mật

**Tuần:** Week 1 / Day 6

### Tại sao không để refreshToken trong body/localStorage?

| Cách lưu | XSS | CSRF | Ghi chú |
|---|---|---|---|
| `localStorage` | ❌ Dễ bị đánh cắp | ✓ An toàn | Không nên dùng cho sensitive token |
| Body (memory) | ✓ An toàn | ✓ An toàn | Mất khi F5 → phải refresh lại |
| httpOnly Cookie | ✓ JS không đọc được | ⚠️ Cần `sameSite` | **Best practice** cho refresh token |

### Full pattern — Backend

```ts
// LOGIN: set cookie
async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
  const { accessToken, refreshToken } = await this.authService.login(dto);

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });

  return { data: { accessToken } }; // chỉ trả accessToken trong body
}

// REFRESH: đọc từ cookie
async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
  const refreshToken = req.cookies['refreshToken'];
  if (!refreshToken) throw AuthErrors.invalidToken();

  const { accessToken, refreshToken: newToken } = await this.authService.refresh(refreshToken);

  res.cookie('refreshToken', newToken, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });

  return { data: { accessToken } };
}

// LOGOUT: clear cookie
async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
  // ... blacklist access token ...

  res.clearCookie('refreshToken', { path: '/api/v1/auth' }); // ← path phải khớp khi set
  return { data: { message: 'Logged out successfully' } };
}
```

### Frontend — `withCredentials: true`

```ts
// Bắt buộc để browser gửi/nhận cookie cross-origin
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true, // ← global cho toàn bộ request
});
```

### CORS phải config đúng

```ts
// main.ts — KHÔNG dùng origin: '*' khi credentials: true
app.enableCors({
  origin: process.env.FRONTEND_URL ?? 'http://localhost:3000', // explicit origin
  credentials: true, // ← bắt buộc
});
```

---
