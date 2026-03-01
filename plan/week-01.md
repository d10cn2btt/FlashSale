# Week 01 — Architecture & Auth

> **Phase:** 1 — NestJS + NextJS Foundation
> **Summary:** Tuần đầu tiên tập trung vào việc thiết kế hệ thống TRƯỚC khi viết code. Setup toàn bộ infrastructure, implement auth flow hoàn chỉnh với JWT + Refresh Token + Redis blacklist. Mục tiêu: hiểu sâu WHY, không chỉ HOW.

---

## 🎯 Goal cuối tuần
- [ ] FlashDeal chạy được với `docker-compose up`
- [ ] Auth hoàn chỉnh: Register, Login, Logout, Refresh Token
- [ ] Token blacklist bằng Redis (logout thật sự)
- [ ] NextJS: Auth context, protected routes, axios interceptor

---

## Day 1 (Thứ 2) — Architecture Design

### Buổi sáng: Vẽ tay, không code
**Mục tiêu: Hiểu toàn bộ hệ thống trước khi chạm vào keyboard**

- [ ] Vẽ high-level architecture diagram:
  ```
  Browser → NextJS (SSR/CSR)
           → NestJS API → PostgreSQL
                        → Redis (cache + session)
                        → BullMQ (queue)
  ```
- [ ] Thiết kế database schema trên giấy:
  - `users` (id, email, password_hash, role, created_at)
  - `products` (id, name, price, stock, created_at)
  - `flash_sales` (id, product_id, discount_price, start_at, end_at, max_qty)
  - `orders` (id, user_id, flash_sale_id, qty, status, created_at)
  - `inventory` (id, product_id, quantity, updated_at)

**So sánh với Laravel:** Giống Eloquent migrations, nhưng Prisma schema khác gì?

### Buổi chiều: Setup project
- [ ] Init NestJS: `nest new flashdeal-backend`
- [ ] Init NextJS: `npx create-next-app flashdeal-frontend`
- [ ] Viết `docker-compose.yml`:
  ```yaml
  services:
    postgres:
    redis:
    pgadmin:
  ```
- [ ] Setup Prisma schema theo design buổi sáng
- [ ] Chạy `docker-compose up` → kết nối được DB

**Deliverable:** Project structure khởi tạo, DB chạy trong Docker

---

## Day 2 (Thứ 3) — NestJS Fundamentals

### Buổi sáng: Hiểu NestJS từ góc nhìn Laravel dev

| Laravel | NestJS | Ghi chú |
|---|---|---|
| ServiceProvider | Module | Container DI |
| Controller | Controller | Giống nhau |
| Service/Repository | Service | Injectable |
| Middleware | Middleware / Guard | Guard mạnh hơn |
| Form Request | DTO + class-validator | Validate input |
| Policy | Guard + Decorator | Authorization |

- [ ] Đọc code của project `nestjs_ssd` hiện có — hiểu structure
- [ ] Tạo `UserModule` với đầy đủ: Module, Controller, Service

### Buổi chiều: Prisma setup
- [ ] Config Prisma connect to Docker PostgreSQL
- [ ] Chạy migration
- [ ] Tạo `PrismaService` (singleton)
- [ ] Seed data cơ bản: admin user + 5 products

**Tự hỏi:** *"Prisma vs TypeORM vs raw SQL — khi nào dùng cái nào?"*

---

## Day 3 (Thứ 4) — Auth: Register & Login

### Buổi sáng: Implement Register + Login

**Không copy — tự implement từng bước:**

- [ ] `POST /auth/register`:
  - Hash password bằng bcrypt (tại sao bcrypt? tại sao không MD5?)
  - Validate email unique
  - Return user info (không có password)

- [ ] `POST /auth/login`:
  - Verify password với bcrypt
  - Generate **Access Token** (15 phút) + **Refresh Token** (7 ngày)
  - Tại sao cần 2 token? Viết lý do ra comment trong code

**So sánh với Laravel:** Sanctum dùng 1 token — tại sao JWT cần 2?

### Buổi chiều: JWT Guard
- [ ] Implement `JwtStrategy` (Passport)
- [ ] Implement `JwtAuthGuard`
- [ ] `@Public()` decorator cho route không cần auth
- [ ] Test với Postman/Thunder Client

**Tự hỏi:** *"Token lưu ở đâu phía client? Cookie vs localStorage — trade-off?"*

---

## Day 4 (Thứ 5) — Refresh Token + Redis Blacklist

### Buổi sáng: Refresh Token Rotation + Token Family

- [ ] Thêm cột `family` vào bảng `refresh_tokens`:
  - Mỗi lần login tạo 1 UUID mới làm `family`
  - Mọi token sinh ra từ cùng session dùng chung family này

- [ ] `POST /auth/refresh` với logic đầy đủ:
  ```typescript
  // 1. Verify JWT signature
  // 2. Find token in DB, check not expired
  // 3. Check revokedAt:
  //    - revokedAt != null AND (now - revokedAt) < 5s → Grace Period
  //      → chỉ reject, không nuclear (có thể là multi-tab race)
  //    - revokedAt != null AND (now - revokedAt) >= 5s → TOKEN THEFT!
  //      → revoke TẤT CẢ tokens cùng family
  //      → 401 TOKEN_REUSE_DETECTED
  // 4. Revoke token hiện tại
  // 5. Tạo cặp token mới, lưu với cùng family
  ```

**Tại sao cần Grace Period?**
```
Không có Grace Period:
  Bạn mở 2 tab, cả 2 cùng hết token
  Tab A refresh → token A revoked, token B issued
  Tab B (50ms sau) refresh với token A → reuse detected!
  → cả 2 tab bị logout — false positive

Với Grace Period 5s:
  Tab B trong 5s → rejected nhẹ, không nuclear
  Hacker dùng token cũ sau 5s → mới là có vấn đề thật
```

**Tại sao Token Family tốt hơn "revoke all user tokens"?**
```
User dùng 3 thiết bị: điện thoại, laptop, iPad
Mỗi thiết bị có 1 family riêng

Nếu phone bị compromise → chỉ revoke family của phone
Laptop và iPad vẫn hoạt động bình thường
```

### Buổi chiều: Redis Token Blacklist + Fail-Closed

- [ ] Setup Redis client trong NestJS
- [ ] `POST /auth/logout`:
  - Lấy `jti` từ access token
  - `SET blacklist:token:{jti} 1 EX {remaining_seconds}`
  - Nếu Redis down → throw `503 SERVICE_UNAVAILABLE` (không được logout thành công)
  - Revoke refresh token trong DB

- [ ] Sửa `JwtAuthGuard` → check Redis blacklist với fail-closed:
  ```typescript
  try {
    const blacklisted = await redis.get(`blacklist:token:${jti}`)
    if (blacklisted) throw new UnauthorizedException()
  } catch (err) {
    if (err instanceof UnauthorizedException) throw err
    // Redis error → fail closed: security > availability
    throw new ServiceUnavailableException('Auth service unavailable')
  }
  ```

**Fail-closed vs Fail-open — phải chọn:**
- Fail-closed: Redis down → mọi request bị reject → app chết nhưng an toàn
- Fail-open: Redis down → bỏ qua kiểm tra → logout vô hiệu, token vẫn dùng được
- FlashDeal → **fail-closed** (tiền bạc liên quan, security quan trọng hơn uptime)

**Tự hỏi:** *"Làm sao giảm thiểu downtime khi Redis chết? → Redis Sentinel, health check, circuit breaker"*

**Deliverable:** Auth flow hoàn chỉnh, logout vô hiệu hóa token ngay lập tức, token theft bị phát hiện

---

## Day 5 (Thứ 6) — NextJS Auth

### Buổi sáng: Auth Context + Axios
- [ ] Setup `AuthContext` với React Context API
- [ ] Axios instance với interceptor:
  - Request: tự động thêm Bearer token
  - Response: nếu 401 → tự động call refresh → retry request gốc
- [ ] Lưu access token trong memory (không localStorage!)
- [ ] Lưu refresh token trong httpOnly cookie

### Buổi chiều: Protected Routes + UI
- [ ] `ProtectedRoute` component
- [ ] Login page
- [ ] Register page
- [ ] Redirect sau login

**Tự hỏi:** *"Tại sao access token trong memory, refresh token trong httpOnly cookie?"*

---

## Day 6 (Thứ 7) — Integration & Polish

- [ ] Test toàn bộ auth flow end-to-end
- [ ] Handle edge cases:
  - Token expired
  - Invalid token
  - Concurrent refresh requests (chỉ refresh 1 lần)
- [ ] Thêm rate limiting cho `/auth/login` (chống brute force)
- [ ] Viết README cho project

**Deliverable:** Demo được auth flow hoàn chỉnh

---

## Day 7 (Chủ Nhật) — Review & Reflection

### Không code — chỉ suy nghĩ

- [ ] Tự trả lời không nhìn tài liệu:
  1. Tại sao cần refresh token?
  2. Redis blacklist hoạt động thế nào?
  3. httpOnly cookie là gì, tại sao quan trọng?
  4. Module trong NestJS khác Provider thế nào?

- [ ] Viết `WEEK01-REVIEW.md` trong project:
  - Học được gì
  - Còn confuse ở đâu
  - So sánh NestJS vs Laravel

---

## 📚 Tài liệu tham khảo
- [NestJS Docs — Authentication](https://docs.nestjs.com/security/authentication)
- [JWT.io — Debugger](https://jwt.io)
- [Redis Docs — SET EX](https://redis.io/commands/set/)
- [OWASP — JWT Security](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)

---

*← [README](./README.md) | [Week 02 →](./week-02.md)*
