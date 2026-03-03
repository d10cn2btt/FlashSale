# Week 06 — Caching Patterns Nâng Cao

> **Phase:** 2 — System Design
> **Summary:** Week 2 đã dùng Cache-Aside cơ bản. Tuần này đi sâu vào các patterns caching phức tạp hơn: Write-Through, Write-Behind, Cache Stampede, Thundering Herd — và khi nào dùng cái nào. Cuối tuần: thiết kế caching layer hoàn chỉnh cho FlashDeal.

---

## 🎯 Goal cuối tuần
- [ ] Hiểu và implement được 4 caching patterns
- [ ] Giải quyết Cache Stampede trong FlashDeal
- [ ] Redis data structures nâng cao (Sorted Set, Bitmap)
- [ ] Cache hit rate dashboard

---

## Day 1 (Thứ 2) — Caching Patterns

### Buổi sáng: 4 Core Patterns

**1. Cache-Aside (đã biết)**
```
Read: App check cache → miss → read DB → populate cache
Write: App write DB → invalidate cache
```
- Tốt cho: read-heavy workloads
- Vấn đề: cache miss có thể overload DB

**2. Write-Through**
```
Write: App write DB + write cache đồng thời
Read: App check cache → luôn hit (nếu data đã được write)
```
- Tốt cho: data cần consistent ngay lập tức
- Vấn đề: write chậm hơn, cache có data không bao giờ đọc

**3. Write-Behind (Write-Back)**
```
Write: App write cache ngay → queue write DB async
Read: App check cache → hit
```
- Tốt cho: write-heavy workloads (counters, analytics)
- Vấn đề: data loss nếu cache fail trước khi sync DB

**4. Read-Through**
```
App chỉ làm việc với cache layer
Cache layer tự load từ DB khi miss
```
- Tốt cho: đơn giản hóa app code
- Vấn đề: cần cache layer thông minh hơn (Redis → app → DB)

### Buổi chiều: Apply vào FlashDeal

| Data | Pattern | Lý do |
|---|---|---|
| Product detail | Cache-Aside | Read-heavy, thay đổi ít |
| Flash sale static info | Cache-Aside + 5 phút | name, price, startAt không đổi trong sale |
| Flash sale `remainingQty` | **Không cache** | Lấy trực tiếp từ Redis inventory key |
| View counter | Write-Behind | Write-heavy, eventual ok |
| User session | Write-Through | Cần consistent |

**Quan trọng — `remainingQty` không đi qua cache layer:**
```
Sai: cache flash_sale bao gồm remainingQty → stale data mỗi 30s
Đúng: cache phần static, remainingQty = GET inventory:{id} trực tiếp

GET inventory:{id} là O(1), ~0.1ms → không cần cache thêm
Cache chỉ có giá trị khi tránh được DB query, Redis đã nhanh rồi
```

- [ ] Refactor FlashDeal để tách cache static vs realtime inventory

---

## Day 2 (Thứ 3) — Cache Stampede & Thundering Herd

### Buổi sáng: Hiểu vấn đề

**Cache Stampede (Dog-piling):**
```
1. Popular item cache expired
2. 1000 requests cùng lúc → cache MISS
3. 1000 requests cùng lúc hit DB
4. DB chết
```

**Solutions:**
1. **Probabilistic Early Expiration** — tự gia hạn cache trước khi expire
2. **Mutex/Lock** — chỉ 1 request được phép populate cache
3. **Stale-While-Revalidate** — trả stale data trong khi refresh background

### Buổi chiều: Implement Solutions

- [ ] **Solution A: Mutex Lock với Redis**
  ```typescript
  async getWithLock(key: string, fetchFn: () => Promise<T>): Promise<T> {
    const cached = await this.get(key)
    if (cached) return cached

    const lockKey = `lock:${key}`
    const acquired = await this.redis.set(lockKey, '1', 'NX', 'EX', 5)

    if (!acquired) {
      // Ai đó đang fetch → chờ và retry
      await sleep(100)
      return this.getWithLock(key, fetchFn)
    }

    try {
      const data = await fetchFn()
      await this.set(key, data, 300)
      return data
    } finally {
      await this.redis.del(lockKey)
    }
  }
  ```

- [ ] **Solution B: Stale-While-Revalidate**
  - Thêm `stale_until` vào cached data
  - Nếu `now < stale_until`: return stale, trigger background refresh
  - Nếu `now > stale_until`: block và refresh

- [ ] Test cả 2 solution với load test tool

---

## Day 3 (Thứ 4) — Redis Data Structures Nâng Cao

### Buổi sáng: Sorted Sets cho Leaderboard

**Use case: Top Flash Sales by popularity**

```typescript
// Add/update score
await redis.zadd('flash_sales:popular', score, flashSaleId)

// Get top 10
await redis.zrevrange('flash_sales:popular', 0, 9, 'WITHSCORES')

// Get rank of item
await redis.zrevrank('flash_sales:popular', flashSaleId)
```

- [ ] Implement popularity ranking cho flash sales
- [ ] Update score khi có order (thêm 10 points) hoặc view (thêm 1 point)
- [ ] API: `GET /flash-sales/popular?limit=10`

### Buổi chiều: Bitmap cho Feature Flags & Analytics

```typescript
// Track which users viewed a flash sale
// Bit position = user_id, value = 1 nếu đã xem

await redis.setbit(`flash_sale:${id}:views`, userId, 1)

// Count unique viewers
await redis.bitcount(`flash_sale:${id}:views`)

// Check if user viewed
await redis.getbit(`flash_sale:${id}:views`, userId)
```

- [ ] Implement unique view tracking với Bitmap
- [ ] So sánh memory: Bitmap vs Set vs DB count
- [ ] Daily Active Users tracking với Bitmap

**Tự hỏi:** *"Bitmap cho 10M users: chỉ 1.25MB. Set cho 10M users: ~300MB. Tại sao lại khác nhau lớn thế?"*

---

## Day 4 (Thứ 5) — Redis Pub/Sub & Streams

### Buổi sáng: Pub/Sub cho Real-time

```typescript
// Publisher
await redis.publish('orders:new', JSON.stringify(orderData))

// Subscriber
redis.subscribe('orders:new', (message) => {
  // Notify connected clients via SSE/WebSocket
})
```

- [ ] Flash sale start notification:
  - Khi flash sale bắt đầu → publish event
  - Connected clients nhận notification

### Buổi chiều: Redis Streams (nâng cao)

```
Redis Streams > Pub/Sub:
- Persistent (không mất messages nếu consumer offline)
- Consumer groups (multiple consumers, mỗi message chỉ 1 consumer xử lý)
- Message acknowledgment
```

- [ ] Convert analytics queue từ BullMQ sang Redis Streams (optional)
- [ ] Hiểu khi nào Streams tốt hơn BullMQ

---

## Day 5 (Thứ 6) — Caching Strategy Review

### Buổi sáng: Cache Metrics Dashboard

- [ ] Track với Redis:
  ```
  INCR cache:hits
  INCR cache:misses
  ```
- [ ] Admin endpoint: `GET /admin/cache/stats`
  ```json
  {
    "hitRate": 0.87,
    "totalRequests": 10000,
    "memoryUsedMB": 125,
    "topKeys": [...]
  }
  ```

### Buổi chiều: Cache Eviction Policies

```
Redis eviction policies (khi memory full):
- noeviction: return error (BAD cho cache)
- allkeys-lru: evict least recently used ← tốt cho cache
- volatile-lru: evict LRU keys có TTL
- allkeys-lfu: evict least frequently used
```

- [ ] Config Redis `maxmemory` + `maxmemory-policy allkeys-lru`
- [ ] Test: fill cache đến max → quan sát eviction behavior
- [ ] Tại sao cache không nên là source of truth?

---

## Day 6 (Thứ 7) — Multi-level Cache

### L1/L2 Cache Architecture

```
Request → In-Memory (L1, ms) → Redis (L2, ms) → DB (100ms+)
          NodeJS process         Shared cache
          ~1ms                   ~5ms
```

- [ ] Implement L1 cache bằng `node-lru-cache`
- [ ] L1 TTL ngắn (30s), L2 TTL dài hơn (5 phút)
- [ ] Vấn đề: multiple instances có L1 khác nhau → cache inconsistency
- [ ] Giải quyết: Redis Pub/Sub để invalidate L1 trên tất cả instances

---

## Day 7 (Chủ Nhật) — Design Review

### Thiết kế caching cho Twitter-like app:

- Tweets mới: cache strategy nào?
- Timeline của user: cache hay compute on-the-fly?
- Follow count / follower count: counter cache?
- Trending topics: sorted sets?

**Tự trả lời:**
1. Cache-Aside vs Write-Through — chọn cái nào và khi nào?
2. Cache Stampede xảy ra thế nào? 3 cách fix?
3. Redis Sorted Set dùng cho bài toán gì?
4. Tại sao không cache mọi thứ?

---

## 📚 Tài liệu tham khảo
- [Redis Data Structures](https://redis.io/docs/data-types/)
- [Caching Strategies by AWS](https://docs.aws.amazon.com/whitepapers/latest/database-caching-strategies-using-redis/caching-patterns.html)
- [Cache Stampede Solutions](https://redislabs.com/blog/cache-stampede-dog-piling/)

---

*← [Week 05](./week-05.md) | [Week 07 →](./week-07.md)*
