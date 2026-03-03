# Week 16 — Performance Optimization

> **Phase:** 4 — Advanced Systems
> **Summary:** Optimization cuối cùng — nhưng nhớ: "Premature optimization is the root of all evil." Chỉ optimize khi đã đo được. Tuần này: profiling, memory leaks, database query optimization nâng cao, và horizontal scaling readiness. Kết thúc Phase 4 với FlashDeal production-grade.

---

## 🎯 Goal cuối tuần (Milestone M6)
- [ ] Identify và fix ít nhất 3 performance bottlenecks
- [ ] Memory usage stable (không có leaks)
- [ ] p99 latency < 500ms cho mọi endpoint
- [ ] Load test: 1000 concurrent users sustained

---

## Day 1 (Thứ 2) — Profiling & Benchmarking

### Buổi sáng: "Measure First, Optimize Second"

**Rule:** Không optimize gì cả mà chưa có baseline metrics.

**Profiling tools:**
```bash
# Node.js built-in profiler
node --prof dist/main.js
node --prof-process isolate-*.log > processed.txt

# Better: clinic.js (visual)
npx clinic doctor -- node dist/main.js
npx clinic flame -- node dist/main.js  # Flamegraph

# Artillery: load testing
npx artillery run load-test.yml
```

### Buổi chiều: Establish Baselines

- [ ] Load test FlashDeal với 100 concurrent users:
  ```yaml
  # load-test.yml
  config:
    target: 'http://localhost:3000'
    phases:
      - duration: 60
        arrivalRate: 100
    defaults:
      headers:
        Authorization: "Bearer {{ token }}"

  scenarios:
    - flow:
        - get:
            url: "/api/v1/flash-sales/active"
        - get:
            url: "/api/v1/products?page=1"
  ```

- [ ] Document baseline: p50, p95, p99 latency + error rate
- [ ] Identify slowest 3 endpoints

---

## Day 2 (Thứ 3) — Node.js Performance

### Buổi sáng: Event Loop Blocking

```
Node.js: single-threaded, event loop
Blocking event loop = ALL requests slow

Common blockers:
  - Synchronous crypto (bcrypt cần nhiều rounds)
  - Heavy JSON.parse/stringify
  - Synchronous file operations
  - Long-running computation
```

**bcrypt blocking solution:**
```typescript
// bcrypt: synchronous rounds, CPU-intensive
// Fix: worker threads hoặc giảm rounds (cost=10 trong production là đủ)

// WRONG in high traffic:
const hash = bcrypt.hashSync(password, 14)  // 14 rounds too slow

// RIGHT:
const hash = await bcrypt.hash(password, 10)  // async + 10 rounds = ~100ms
```

**JSON serialization:**
```typescript
// For large objects: fast-json-stringify
import fastJson from 'fast-json-stringify'

const stringify = fastJson({
  type: 'object',
  properties: {
    id: { type: 'number' },
    name: { type: 'string' },
  }
})

// 2-10x faster than JSON.stringify for large objects
```

### Buổi chiều: Memory Management

- [ ] Memory profiling:
  ```bash
  node --expose-gc --inspect dist/main.js
  # Chrome DevTools → Memory tab → heap snapshot
  ```

- [ ] Common memory leaks:
  - Event listener không được remove
  - Cache không có TTL (unlimited growth)
  - Closures giữ reference đến large objects

- [ ] Load test → watch memory với `clinic doctor`

---

## Day 3 (Thứ 4) — Database Performance Nâng Cao

### Buổi sáng: Query Performance Budget

```
Performance budget:
  Simple read (with cache): < 5ms
  DB read (indexed): < 50ms
  DB write: < 100ms
  Complex query: < 200ms
  Everything else: investigate
```

- [ ] Enable slow query logging trong PostgreSQL:
  ```sql
  -- Log queries > 100ms
  ALTER SYSTEM SET log_min_duration_statement = '100';
  SELECT pg_reload_conf();
  ```

- [ ] Analyze top 5 slow queries
- [ ] Fix bằng: index, query rewrite, caching

### Buổi chiều: Bulk Operations

```typescript
// WRONG: N inserts
for (const item of items) {
  await prisma.orderItem.create({ data: item })
}
// 100 items = 100 queries

// RIGHT: Bulk insert
await prisma.orderItem.createMany({
  data: items,
  skipDuplicates: true,
})
// 100 items = 1 query
```

- [ ] Refactor bất kỳ chỗ nào loop với DB calls
- [ ] Batch analytics updates

---

## Day 4 (Thứ 5) — Caching Final Sweep

### Buổi sáng: Cache Audit

- [ ] Review cache hit rates trong Grafana
- [ ] Identify endpoints vẫn đang miss > 30%
- [ ] Review TTL values:
  - Quá ngắn → nhiều misses → DB pressure
  - Quá dài → stale data

### Buổi chiều: Response Compression

```typescript
import * as compression from 'compression'

app.use(compression({
  filter: (req, res) => {
    // Không compress small responses (overhead > benefit)
    if (req.headers['x-no-compression']) return false
    return compression.filter(req, res)
  },
  level: 6  // 0-9, 6 là balance tốt
}))
```

- [ ] Enable GZIP/Brotli compression
- [ ] Measure response size before/after
- [ ] Set proper Cache-Control headers cho static assets

---

## Day 5 (Thứ 6) — Load Testing at Scale

### Buổi sáng: 1000 Concurrent Users

```yaml
# load-test-high.yml
config:
  target: 'https://staging.flashdeal.com'
  phases:
    - duration: 60    # Warm up
      arrivalRate: 100
    - duration: 300   # Sustained load
      arrivalRate: 500
    - duration: 60    # Peak
      arrivalRate: 1000
    - duration: 60    # Cool down
      arrivalRate: 100
```

- [ ] Run load test
- [ ] Monitor trong Grafana:
  - Error rate
  - Latency degradation
  - Memory growth
  - DB connection pool saturation

### Buổi chiều: Fix Bottlenecks Found

Thường gặp:
- DB connection pool exhausted → increase pool size
- Redis connection pool → increase hoặc connection multiplexing
- Memory leak under load → find và fix
- Single endpoint bottleneck → cache/optimize

---

## Day 6 (Thứ 7) — Code Quality & Technical Debt

### Buổi sáng: Code Review Checklist

Mỗi module:
- [ ] Single Responsibility (function chỉ làm 1 việc)
- [ ] Dependency Injection properly
- [ ] Error handling đầy đủ (không có unhandled promise rejections)
- [ ] Logging có ý nghĩa
- [ ] Tests cover critical paths

### Buổi chiều: Document Architecture Decisions

- [ ] Viết `ADR` (Architecture Decision Records):
  ```markdown
  # ADR 001: Redis cho Distributed Lock

  Status: Accepted
  Date: 2026-03-XX

  Context: Cần ngăn overselling trong flash sales

  Decision: Dùng Redis SET NX EX pattern

  Consequences:
  + Simple, fast
  - Redis down → orders fail (acceptable trade-off)
  ```

---

## Day 7 (Chủ Nhật) — Phase 4 Complete

### Milestone M6: Senior-level nhìn vào FlashDeal

**Checklist:**
- [ ] Indexing strategy documented
- [ ] Caching policy documented
- [ ] Security audit passed
- [ ] Load tested at 1000 concurrent
- [ ] Performance budget defined và met
- [ ] ADRs written cho major decisions
- [ ] Monitoring + alerting active

### Chuẩn bị Phase 5:
Đọc: [Week 17 — Specs-Driven Development](./week-17.md)

Tự hỏi: *"Mày đang dùng AI như thế nào khi code? Có improve được không?"*

---

## 📚 Tài liệu tham khảo
- [clinic.js](https://clinicjs.org/) — Node.js profiling
- [Artillery Load Testing](https://artillery.io/docs/)
- [ADR GitHub](https://github.com/joelparkerhenderson/architecture-decision-record)
- [Node.js Performance Best Practices](https://nodejs.org/en/learn/getting-started/profiling)

---

*← [Week 15](./week-15.md) | [Week 17 →](./week-17.md)*
