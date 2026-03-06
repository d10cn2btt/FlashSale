# AI Context — FlashDeal Project

> Paste file này vào đầu mỗi conversation mới với AI.
> Cập nhật "Current Status" mỗi khi hoàn thành 1 tuần.

---

## Project đang làm: FlashDeal

**Mini Flash Sale Platform** — platform bán hàng giảm giá trong thời gian giới hạn.

**Mục đích học:** Buộc phải đối mặt với các vấn đề scaling thật:
race condition, caching, distributed lock, queue, horizontal scaling.

### Chạy local hoàn toàn bằng Docker Compose
- PostgreSQL, Redis, MailHog (fake SMTP), pgAdmin
- Không cần cloud cho 10 tuần đầu

---

## Learning Plan (18 tuần)

| Phase | Tuần | Nội dung |
|---|---|---|
| Phase 1 | 1-4 | NestJS + NextJS Foundation — Build FlashDeal |
| Phase 2 | 5-8 | System Design — DB, Cache, Queue, API |
| Phase 3 | 9-12 | DevOps — Docker, CI/CD, Cloud, Monitoring |
| Phase 4 | 13-16 | Advanced — Search, Microservices, Security, Perf |
| Phase 5 | 17-18 | AI Engineering — Specs-driven, Agentic |

Full plan: `plan\`

---

## Patterns hay dùng

| Pattern | Mô tả | Ví dụ trong project |
|---|---|---|
| **Facade** | Bọc subsystem sau interface đơn giản, giấu implementation detail | `redisService.isTokenBlacklisted(jti)` thay vì `redis.get('blacklist:token:' + jti)` |
| **Encapsulation** | Tập trung key generation / logic lặp lại vào 1 chỗ, tránh hardcode rải rác | Redis key format chỉ define trong `RedisService`, nơi khác gọi method |
| **Extract Method** | Method dài → tách thành method nhỏ, mỗi cái 1 việc | `canActivate` gọi `checkBlacklist()` thay vì viết inline |
| **Fail-Closed** | Khi dependency down → từ chối request, ưu tiên security hơn availability | Redis down → 503 thay vì bỏ qua blacklist check |
| **Minimize try/catch scope** | `try/catch` chỉ bọc đúng I/O call, không bọc business logic | Chỉ bọc `redis.get()`, để `if (isBlacklisted) throw` nằm ngoài |
| **Refresh Token Rotation** | Mỗi lần refresh → token cũ revoke, cấp token mới. Dùng 1 lần duy nhất | Grace period 5s chống false positive, Token Family để detect theft |
| **Error Factory** | Tập trung error codes/messages vào 1 file `common/errors/`, không hardcode rải rác | `AuthErrors.invalidCredentials()` thay vì `new UnauthorizedException({...})` ở nhiều chỗ |
| **Error Factory** | Tập trung error codes/messages vào 1 object, không hardcode rải rác | `AuthErrors.invalidCredentials()` thay vì `new UnauthorizedException({...})` ở nhiều chỗ |

> Chi tiết + code example: `plan/patterns.md`

---

## Current Status

**Đang ở:** Week 2 / Day 1

**Đã hoàn thành:**
- [x] Week 1: Auth System ✅
- [ ] Week 2: Core Features + Race Condition *(in progress)*
- [ ] Week 3: Queue + Async
- [ ] Week 4: Testing + Deploy

**Week 1 progress:**
- [x] Day 1: Project init — NestJS + NextJS + Docker Compose + Prisma schema + migrate thành công
- [x] Day 2: PrismaService (@Global), UserModule (Module + Controller + Service), seed data (4 users + 5 products + flash sales + orders)
- [x] Day 3: Register + Login (access token 15m + refresh token 7d), JwtStrategy, JwtAuthGuard, @Public() decorator
- [x] Day 4: RedisModule, Logout (Redis blacklist fail-closed), Refresh Token Rotation (Grace Period 5s + Token Family theft detection), refactor Error Factory
- [x] Day 5: NextJS Auth — AuthContext, axios interceptor (request Bearer + response 401→refresh→retry + queue concurrent requests), access token in memory, protected route (dashboard layout), Login page, Register page, redirect sau login
  - **Bonus fixes:** `/auth/me` endpoint, `name` field add vào User (migration), CORS config, backend port 5000, fix infinite loop `/login` (flag `_skipRefresh`)
- [x] Day 6: Integration & Polish
  - Fix refresh token: BE chuyển từ body → httpOnly cookie (`cookie-parser`, `@Res({ passthrough: true })`, `res.cookie()`)
  - Fix `withCredentials: true` global trên `apiClient`
  - Fix login page redirect nếu đã authenticated (`useEffect` check `isAuthenticated`)
  - Fix interceptor whitelist public paths `/login`, `/register`
  - Fix error message: `extractErrorMessage()` trong interceptor normalize 2 format lỗi BE
  - Rate limiting: `@nestjs/throttler` cho `/auth/login` và `/auth/register` (5 req/60s → 429)
  - Viết README

**Week 2 progress:**
- [x] Day 1: Product Module CRUD + Flash Sale Module + RolesGuard
- [ ] Day 2: Redis Cache-Aside pattern + CacheService + Benchmark
- [ ] Day 3: Order flow + Tạo race condition có chủ ý
- [ ] Day 4: Fix race condition — DB Optimistic Lock → Lua script atomic
- [ ] Day 5: NextJS Flash Sale UI + Order flow UI
- [ ] Day 6: E2E Testing + Global exception filter
- [ ] Day 7: Deep Dive Review

**Task tiếp theo:** Day 1 — Product Module + Flash Sale Module
- [ ] GET/POST/PUT/DELETE /products với RolesGuard
- [ ] POST /flash-sales + GET /flash-sales/active
- [ ] RolesGuard + @Roles('admin') decorator

**Vấn đề / câu hỏi:** [điền vào trước khi paste]

---

## Prompt Templates hay dùng

### Bắt đầu task mới:
```
[Paste file AI-CONTEXT.md]

Task hôm nay: [tên task]
Đang implement: [module/file]
Cần giúp: [cụ thể]
```

### Review code:
```
[Paste file AI-CONTEXT.md]

Review đoạn code này:
[paste code]

Focus vào: security + performance + edge cases
So sánh với conventions của project.
```

### Debug:
```
[Paste file AI-CONTEXT.md]

Lỗi: [paste error message + stack trace]
Xảy ra khi: [mô tả action]
Code liên quan: [paste]
Tao đã thử: [những gì đã làm]
```

### Hỏi concept:
```
Giải thích [concept] trong context của FlashDeal.
Cho ví dụ cụ thể với code NestJS/Prisma/Redis.
Tao đang ở Week [X] nên giữ ở mức phù hợp.
```

### Ask for review trước khi implement:
```
[Paste file AI-CONTEXT.md]

Tao sắp implement [feature].
Đây là plan của tao: [mô tả]
Review plan: có gì thiếu, có gì sai không?
Đừng code ngay — chỉ review plan thôi.
```
