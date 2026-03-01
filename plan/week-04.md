# Week 04 — Testing, Polish & NestJS Deep Dive

> **Phase:** 1 — NestJS + NextJS Foundation
> **Summary:** Tuần consolidation — không thêm feature mới. Tập trung vào testing (unit, integration, e2e), hiểu sâu các concept NestJS nâng cao (interceptors, pipes, lifecycle), và deploy lên môi trường thật lần đầu. Kết thúc Phase 1 với app production-ready v1.

---

## 🎯 Goal cuối tuần (Milestone M3)
- [ ] Unit test coverage > 70% cho business logic
- [ ] Integration tests cho critical paths
- [ ] App deployed và accessible qua URL thật
- [ ] CI/CD pipeline: push code → auto deploy
- [ ] Performance benchmark documented

---

## Day 1 (Thứ 2) — Unit Testing

### Buổi sáng: Triết lý testing

**Không test để coverage — test để confidence:**
```
Unit test:       Test 1 function/method, mock dependencies
Integration:     Test module + real DB
E2E:             Test từ HTTP request đến DB và back
```

**Testing pyramid cho FlashDeal:**
```
        /\
       /E2E\      ← ít, chậm, tốn
      /──────\
     /  Integ  \   ← vừa phải
    /────────────\
   /  Unit Tests  \ ← nhiều, nhanh, rẻ
  /────────────────\
```

### Buổi chiều: Implement Unit Tests

- [ ] `OrderService.createOrder()` — test các cases:
  - Flash sale không tồn tại → throw NotFoundException
  - Flash sale hết hạn → throw BadRequestException
  - Hết inventory → throw BadRequestException
  - Happy path → return order

- [ ] `CacheService` — mock Redis, test get/set/invalidate

- [ ] `AuthService` — test login, token generation

```typescript
// Ví dụ test structure
describe('OrderService', () => {
  describe('createOrder', () => {
    it('should throw when flash sale not found', async () => {})
    it('should throw when flash sale expired', async () => {})
    it('should throw when out of stock', async () => {})
    it('should create order successfully', async () => {})
  })
})
```

---

## Day 2 (Thứ 3) — Integration Testing

### Buổi sáng: Setup test environment

- [ ] `jest-integration.json` — test với real DB + Redis (local)
- [ ] `TestingModule` setup với real Prisma (test DB)
- [ ] Database cleanup giữa các tests: `beforeEach` truncate tables

### Buổi chiều: Integration tests

- [ ] Order flow e2e test:
  ```typescript
  describe('Order Flow', () => {
    it('concurrent orders respect inventory limit', async () => {
      // Create flash sale with maxQty = 1
      // Run 10 concurrent order requests
      // Assert only 1 succeeded
    })
  })
  ```

- [ ] Cache invalidation test:
  - Tạo product → cache populated
  - Update product → cache invalidated
  - GET product → fresh data (không từ stale cache)

- [ ] Auth flow integration:
  - Login → get tokens
  - Use access token → success
  - Logout → blacklist token
  - Use blacklisted token → 401

---

## Day 3 (Thứ 4) — NestJS Advanced Concepts

### Buổi sáng: Interceptors

```typescript
// Interceptor chạy TRƯỚC và SAU handler
// Dùng cho: logging, transform response, caching, timeout

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now()
    return next.handle().pipe(
      tap(() => console.log(`${Date.now() - start}ms`))
    )
  }
}
```

- [ ] Implement `LoggingInterceptor` — log request time
- [ ] Implement `TransformInterceptor` — wrap response trong `{ data, success, timestamp }`
- [ ] Implement `TimeoutInterceptor` — cancel request nếu > 5 giây

### Buổi chiều: Pipes & Custom Validators

```typescript
// Pipe: transform + validate INPUT trước khi vào handler

// Built-in: ValidationPipe, ParseIntPipe, ParseUUIDPipe
// Custom: business logic validation
```

- [ ] Custom `ParsePositiveIntPipe`
- [ ] Custom `FlashSaleActiveValidationPipe` — check flash sale còn active không tại pipe level
- [ ] Tại sao validate ở pipe thay vì service?

**NestJS Lifecycle — hiểu thứ tự:**
```
Request → Middleware → Guards → Interceptors (before) → Pipes → Handler → Interceptors (after) → Exception Filters
```

---

## Day 4 (Thứ 5) — Performance & Optimization

### Buổi sáng: Profiling

- [ ] Thêm `pino` logger với request timing
- [ ] Identify slow queries với Prisma `$on('query')`:
  ```typescript
  prisma.$on('query', (e) => {
    if (e.duration > 100) {
      logger.warn(`Slow query: ${e.duration}ms: ${e.query}`)
    }
  })
  ```
- [ ] Fix slow queries bằng proper indexes:
  ```sql
  -- Thêm index cho các query thường dùng
  CREATE INDEX idx_flash_sales_active ON flash_sales(start_at, end_at)
    WHERE end_at > NOW();
  CREATE INDEX idx_orders_user_id ON orders(user_id);
  ```

### Buổi chiều: Connection Pooling

- [ ] Hiểu Prisma connection pool
- [ ] Config pool size phù hợp:
  ```
  connection_limit = (core_count × 2) + 1
  ```
- [ ] Load test: 100 concurrent requests → quan sát pool behavior

**Tự hỏi:** *"Pool quá nhỏ → queue up. Pool quá lớn → DB overwhelmed. Cân bằng thế nào?"*

---

## Day 5 (Thứ 6) — Deployment

### Buổi sáng: Docker Production Build

- [ ] `Dockerfile` multi-stage build cho backend:
  ```dockerfile
  # Stage 1: Build
  FROM node:20-alpine AS builder
  ...build...

  # Stage 2: Production
  FROM node:20-alpine AS production
  # Chỉ copy những gì cần — image nhỏ hơn
  ```
- [ ] `Dockerfile` cho frontend
- [ ] Docker image size optimization

### Buổi chiều: Deploy lên Railway/Render

- [ ] Tạo account Railway (free tier)
- [ ] Deploy PostgreSQL + Redis services
- [ ] Deploy backend + frontend
- [ ] Environment variables setup
- [ ] Health check endpoint: `GET /health`

**Health check response:**
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "uptime": 12345
}
```

---

## Day 6 (Thứ 7) — CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - Run unit tests
      - Run integration tests

  build:
    needs: test
    steps:
      - Build Docker image
      - Push to registry

  deploy:
    needs: build
    steps:
      - Deploy to Railway
```

- [ ] Implement full pipeline
- [ ] Test: push code → watch pipeline → auto deploy
- [ ] Add status badge vào README

---

## Day 7 (Chủ Nhật) — Phase 1 Retrospective

### Phase 1 hoàn thành — nhìn lại:

**Đã học được:**
- [ ] NestJS: Modules, Controllers, Services, Guards, Interceptors, Pipes
- [ ] Prisma ORM và migrations
- [ ] JWT Auth với Refresh Token + Redis Blacklist
- [ ] Cache-Aside pattern
- [ ] Race condition + Distributed Lock + Optimistic Locking
- [ ] Queue với BullMQ
- [ ] SSE cho real-time
- [ ] Testing pyramid
- [ ] Docker + CI/CD + Deploy

**Viết `PHASE1-SUMMARY.md`:**
- Những concept khó nhất
- Những lúc bị stuck, fix thế nào
- Nếu làm lại từ đầu, sẽ thay đổi gì

**Chuẩn bị Phase 2:**
- [ ] Đọc trước: [Week 05 — Database Deep Dive](./week-05.md)
- Tự hỏi: *"Database của mình có vấn đề gì khi scale lên 1M records?"*

---

## 📊 Phase 1 Metrics

| Metric | Target |
|---|---|
| Unit test coverage | > 70% |
| API response time (cached) | < 10ms |
| API response time (uncached) | < 200ms |
| Concurrent order handling | 50 req/s without error |
| CI/CD pipeline time | < 5 minutes |

---

## 📚 Tài liệu tham khảo
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)
- [Docker Multi-Stage Build](https://docs.docker.com/build/building/multi-stage/)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

---

*← [Week 03](./week-03.md) | [Week 05 →](./week-05.md)*
