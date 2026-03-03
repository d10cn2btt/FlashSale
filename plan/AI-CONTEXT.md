# AI Context — FlashDeal Project

> Paste file này vào đầu mỗi conversation mới với AI.
> Cập nhật "Current Status" mỗi khi hoàn thành 1 tuần.

---

## Về tao

- Laravel dev đang chuyển sang NestJS + NextJS
- Mục tiêu: hiểu tư duy hệ thống, không chỉ biết code
- Làm việc theo Specs-Driven Development + Co-pilot style (tự làm trước, AI hỗ trợ)
- Hãy ghi nhớ là hướng dẫn tao từng bước một, đừng có tự tiện làm hết, để tao còn hiểu step by step

---

## Project đang làm: FlashDeal

**Mini Flash Sale Platform** — platform bán hàng giảm giá trong thời gian giới hạn.

**Mục đích học:** Buộc phải đối mặt với các vấn đề scaling thật:
race condition, caching, distributed lock, queue, horizontal scaling.

### Tech Stack
```
Backend:    NestJS + Prisma + PostgreSQL
Cache:      Redis (cache + distributed lock + pub/sub)
Queue:      BullMQ (chạy trên Redis)
Frontend:   NextJS + TailwindCSS
Auth:       JWT + Refresh Token + Redis Blacklist
Search:     Elasticsearch (Week 13+)
DevOps:     Docker Compose (local), GitHub Actions CI/CD
Monitoring: Prometheus + Grafana + Loki (Week 12+)
```

### Chạy local hoàn toàn bằng Docker Compose
- PostgreSQL, Redis, MailHog (fake SMTP), pgAdmin
- Không cần cloud cho 10 tuần đầu

### Conventions
- Error format: `{ error: { code: string, message: string } }`
- Success format: `{ data: T }` hoặc `{ data: T[], meta: { total, page } }`
- API prefix: `/api/v1/`
- Auth: Bearer JWT trong Authorization header
- Soft delete: `deletedAt` timestamp
- All tables có: `createdAt`, `updatedAt`

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

## Take note trouble shoot
Hãy take note các lỗi mà tao gặp phải vào 1 file trouble shoot tương ứng của backend & frontend nhé
Nhớ take note kĩ, Nguyên nhân, solution, why

## Take note kỹ thuật
Hãy take note các kỹ thuật mới của Nestjs, Nextjs vào file docs/nestjs.md docs/nextjs.md tương ứng
Nhớ giải thích rõ ràng & cho code ví dụ hoặc trường hợp sử dụng để sau này tao học lại

## Current Status

**Đang ở:** Week 1 / Day 6

**Đã hoàn thành:**
- [ ] Week 1: Auth System *(in progress — Day 5/7)*
- [ ] Week 2: Core Features + Race Condition
- [ ] Week 3: Queue + Async
- [ ] Week 4: Testing + Deploy

**Week 1 progress:**
- [x] Day 1: Project init — NestJS + NextJS + Docker Compose + Prisma schema + migrate thành công
- [x] Day 2: PrismaService (@Global), UserModule (Module + Controller + Service), seed data (4 users + 5 products + flash sales + orders)
- [x] Day 3: Register + Login (access token 15m + refresh token 7d), JwtStrategy, JwtAuthGuard, @Public() decorator
- [x] Day 4: RedisModule, Logout (Redis blacklist fail-closed), Refresh Token Rotation (Grace Period 5s + Token Family theft detection), refactor Error Factory
- [x] Day 5: NextJS Auth — AuthContext, axios interceptor (request Bearer + response 401→refresh→retry + queue concurrent requests), access token in memory, protected route (dashboard layout), Login page, Register page, redirect sau login
  - **Bonus fixes:** `/auth/me` endpoint, `name` field add vào User (migration), CORS config, backend port 5000, fix infinite loop `/login` (flag `_skipRefresh`)

**Task tiếp theo:** Day 6 — Integration & Polish
- [ ] Test toàn bộ auth flow end-to-end (register → login → dashboard → logout → F5 session restore)
- [ ] Handle edge cases: token expired mid-session, invalid token
- [ ] Rate limiting cho `/auth/login` (chống brute force)
- [ ] Viết README cho project

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
