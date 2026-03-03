# Week 02 — Core Features, Caching & Race Condition

> **Phase:** 1 — NestJS + NextJS Foundation
> **Summary:** Tuần quan trọng nhất về tư duy engineering. Build core features của FlashDeal, implement caching đúng cách, và cố tình tạo ra race condition để hiểu vấn đề — rồi fix nó bằng Redis Distributed Lock và DB Optimistic Locking. Đây là thứ junior dev không bao giờ học được nếu chỉ build CRUD app.

---

## 🎯 Goal cuối tuần
- [ ] CRUD Products, Flash Sales hoạt động
- [ ] Cache-Aside pattern với Redis
- [ ] Order flow hoàn chỉnh
- [ ] Race condition: tạo ra → quan sát → fix
- [ ] Benchmark được: cache hit vs miss

---

## Day 1 (Thứ 2) — Product & Flash Sale CRUD

### Buổi sáng: Product Module
- [ ] `GET /products` — list products
- [ ] `GET /products/:id` — detail
- [ ] `POST /products` — tạo mới (admin only)
- [ ] `PUT /products/:id` — cập nhật (admin only)
- [ ] `DELETE /products/:id` — xóa (admin only)

**Role-based access:**
- [ ] `RolesGuard` + `@Roles('admin')`
- [ ] Tại sao dùng Guard thay vì check trong service?

### Buổi chiều: Flash Sale Module
- [ ] `POST /flash-sales` — tạo flash sale
  ```
  {
    productId,
    discountPrice,
    startAt,
    endAt,
    maxQuantity
  }
  ```
- [ ] `GET /flash-sales/active` — list flash sales đang diễn ra
- [ ] Validation: endAt phải sau startAt

**Tự hỏi:** *"Khi có 1000 flash sales cùng lúc, query 'active' sẽ slow thế nào? Index gì?"*

---

## Day 2 (Thứ 3) — Redis Caching (Cache-Aside Pattern)

### Buổi sáng: Hiểu pattern trước khi code

```
Cache-Aside (Lazy Loading):

READ:
  1. Check cache
  2. Cache HIT → return data
  3. Cache MISS → query DB → store in cache → return data

WRITE:
  1. Update DB
  2. Invalidate cache (delete key)
  (Không update cache trực tiếp — tránh race condition)
```

**Tại sao invalidate thay vì update?**
- Update cache: 2 operations, không atomic → race condition
- Invalidate: 1 operation, next read tự populate

### Buổi chiều: Implement Caching

- [ ] Tạo `CacheService` wrapper quanh Redis:
  ```typescript
  get(key: string): Promise<T | null>
  set(key: string, value: T, ttlSeconds: number): Promise<void>
  del(key: string): Promise<void>
  ```

- [ ] Apply vào `GET /products` và `GET /flash-sales/active`:
  - TTL cho products: 5 phút (data ít thay đổi)
  - TTL cho active flash sales: 30 giây (data thay đổi thường xuyên)

- [ ] Invalidate cache khi create/update/delete product

- [ ] **Benchmark tự làm:**
  ```bash
  # Dùng Apache Bench hoặc k6
  # Request 1: MISS → ~150ms
  # Request 2: HIT → ~5ms
  ```

**Tự hỏi:** *"TTL quá ngắn → nhiều cache miss. TTL quá dài → stale data. Cân bằng thế nào?"*

---

## Day 3 (Thứ 4) — Order Flow + Inventory Management

### Buổi sáng: Order Service cơ bản

```
POST /orders
  → Check flash sale còn active không
  → Check còn inventory không
  → Create order
  → Decrease inventory
  → Return order
```

- [ ] Implement flow trên không có protection
- [ ] Viết integration test:
  ```typescript
  // 1 flash sale với maxQty = 1
  // Gửi 1 order → nên thành công
  // Gửi order thứ 2 → nên fail
  ```

### Buổi chiều: Tạo race condition CÓ CHỦ Ý

**Đây là bài học quan trọng nhất:**

- [ ] Viết script gọi 50 request đồng thời:
  ```bash
  # Dùng Apache Bench:
  ab -n 50 -c 50 -p order.json -T application/json \
     http://localhost:3000/orders
  ```

- [ ] Quan sát kết quả: BAO NHIÊU order được tạo với maxQty = 1?
- [ ] Nếu > 1 → **overselling bug** → đây là vấn đề thật

**Giải thích tại sao xảy ra:**
```
Thread A: Check inventory = 1 → OK
Thread B: Check inventory = 1 → OK  (cùng lúc với A!!)
Thread A: Create order → inventory = 0
Thread B: Create order → inventory = -1  ← BUG
```

**Deliverable:** Screenshot/log chứng minh overselling xảy ra

---

## Day 4 (Thứ 5) — Fix Race Condition

### Cách 1: DB Optimistic Locking (Buổi sáng) — Tại sao không đủ

```sql
UPDATE flash_sales
SET sold_qty = sold_qty + 1
WHERE id = $1 AND sold_qty < max_qty
RETURNING *;
-- 0 rows affected → sold out hoặc race → fail
```

- [ ] Implement với `prisma.$executeRaw`, test với 50 concurrent
- [ ] Quan sát: vẫn có oversell không? Tại sao có/không?

**Kết luận:** Optimistic lock ở DB không đủ cho flash sale — DB không phải source of truth cho inventory (Redis mới là). Nếu Redis inventory = 5 và DB sold_qty = 5, DB constraint không biết gì về Redis state.

### Cách 2: Lua Script Atomic (Buổi chiều) — Solution đúng

**Tại sao không dùng Lock nữa?**
```
Vấn đề với Lock+DECR:
  1000 requests → xếp hàng qua 1 lock → bottle neck nghiêm trọng
  Nếu processing > TTL (5s) → 2 thread cùng có lock → race condition trở lại
  Lock holder crash → phải chờ TTL expire → delay 5s cho mọi user

Lua script: không có những vấn đề trên
Redis chạy single-threaded → Lua script atomic by design
Không cần lock → không serialize → throughput cao hơn nhiều lần
```

- [ ] Implement Lua script check-and-decrement:
  ```typescript
  const luaScript = `
    local inv = redis.call('GET', KEYS[1])
    if not inv or tonumber(inv) <= 0 then return -1 end
    return redis.call('DECR', KEYS[1])
  `
  const result = await redis.eval(luaScript, 1, `inventory:${saleId}`)
  if (result === -1) throw new BadRequestException('SOLD_OUT')
  ```

- [ ] Implement INCR rollback nếu DB write fail:
  ```typescript
  // Lua DECR thành công → inventory giảm
  // Nếu DB fail → PHẢI tăng lại để không rò rỉ inventory
  try {
    await prisma.order.create(...)
  } catch (err) {
    await redis.incr(`inventory:${saleId}`)  // rollback
    throw new InternalServerErrorException()
  }
  ```

- [ ] Implement fallback + mutex khi Redis restart (inventory key mất):
  ```typescript
  let inv = await redis.get(`inventory:${saleId}`)
  if (inv === null) {
    // Chỉ 1 request được rebuild key, còn lại chờ
    const lock = await redis.set(`lock:rebuild:${saleId}`, 1, 'NX', 'EX', 5)
    if (!lock) {
      await sleep(200)
      return this.purchase(userId, saleId)  // retry
    }
    const sale = await prisma.flashSale.findUnique(...)
    const remaining = sale.maxQty - sale.soldQty
    const ttl = differenceInSeconds(sale.endAt, new Date())
    await redis.set(`inventory:${saleId}`, remaining, 'EX', ttl)
  }
  // Tiếp tục với Lua script
  ```

- [ ] Test với 100 concurrent requests: `maxQty=10` → đúng 10 orders

**Tự hỏi:**
- *"Nếu INCR rollback cũng fail (Redis down) thì làm gì?"* → log + alert + cron job reconciliation hàng ngày
- *"Tại sao Lua script an toàn mà không cần lock?"* → Redis single-threaded, không có context switch giữa các lệnh trong script

**Deliverable:** 100 concurrent requests, maxQty=10 → chính xác 10 orders thành công, inventory không âm

---

## Day 5 (Thứ 6) — NextJS: Flash Sale UI

### Buổi sáng: Product Listing
- [ ] Server-side rendering với `getServerSideProps`
- [ ] Product grid với TailwindCSS
- [ ] Flash sale countdown timer (client-side)

### Buổi chiều: Order Flow UI
- [ ] Flash Sale detail page
- [ ] "Mua ngay" button với loading state
- [ ] Xử lý các trường hợp:
  - Order thành công
  - Hết hàng
  - Flash sale đã kết thúc
  - Rate limited (429)
- [ ] Order history page

---

## Day 6 (Thứ 7) — E2E Testing & Error Handling

- [ ] Global exception filter trong NestJS
- [ ] Consistent error response format:
  ```json
  {
    "statusCode": 400,
    "message": "Hết hàng",
    "error": "BAD_REQUEST",
    "timestamp": "2026-03-07T..."
  }
  ```
- [ ] Viết e2e test cho order flow:
  - Happy path
  - Out of stock
  - Concurrent orders

---

## Day 7 (Chủ Nhật) — Deep Dive Review

### Câu hỏi tự trả lời:
1. Cache-Aside khác Write-Through thế nào?
2. Tại sao Lua script an toàn mà không cần lock? Redis single-threaded nghĩa là gì?
3. INCR rollback giải quyết vấn đề gì? Có edge case nào không?
4. Nếu Redis restart, flow fallback hoạt động thế nào? Mutex ở bước này để làm gì?

### Vẽ lại architecture:
- Vẽ data flow của 1 order request, từ browser đến DB và back
- Chỉ ra chỗ nào có potential failure

---

## 📊 Metrics tuần này cần đạt:
- Cache hit rate: > 80% trong normal traffic
- Cache response time: < 10ms
- 100 concurrent orders (maxQty=10): chính xác 10 success, 90 fail
- Inventory Redis sau test: đúng = 0, không âm
- Purchase API p95 latency: < 200ms (không có lock serialize nữa)

---

## 📚 Tài liệu tham khảo
- [Redis — SET NX EX pattern](https://redis.io/docs/manual/patterns/distributed-locks/)
- [Martin Fowler — Optimistic Locking](https://martinfowler.com/eaaCatalog/optimisticOfflineLock.html)
- [Caching Strategies](https://codeahoy.com/2017/08/11/caching-strategies-and-how-to-choose-the-right-one/)

---

*← [Week 01](./week-01.md) | [Week 03 →](./week-03.md)*
