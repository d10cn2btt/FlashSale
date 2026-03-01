# Week 05 — Database Deep Dive

> **Phase:** 2 — System Design
> **Summary:** Hầu hết các performance bottleneck trong production đến từ database. Tuần này đi sâu vào PostgreSQL: indexes, query planning, N+1 problem, và connection management. Không học theory suông — benchmark mọi thứ với data thật.

---

## 🎯 Goal cuối tuần
- [ ] Hiểu và áp dụng đúng các loại index
- [ ] Eliminate N+1 queries trong FlashDeal
- [ ] Slow query log setup và có ít nhất 3 optimized queries
- [ ] Hiểu EXPLAIN ANALYZE output

---

## Day 1 (Thứ 2) — How PostgreSQL Works

### Buổi sáng: Internals cơ bản

**Đừng chỉ biết "dùng index cho nhanh" — hiểu TẠI SAO:**

```
Table = Heap (unsorted data pages)
Index = B-tree/Hash structure trỏ về heap
Sequential Scan = đọc toàn bộ heap
Index Scan = đọc index → jump đến heap rows
```

- [ ] Load 1 triệu records vào bảng `orders` (dùng script seed)
- [ ] `SELECT * FROM orders WHERE user_id = 123` — không có index
  - `EXPLAIN ANALYZE` → quan sát Seq Scan, cost, actual time
- [ ] Thêm index: `CREATE INDEX idx_orders_user_id ON orders(user_id)`
- [ ] Chạy lại query → quan sát Index Scan, cost giảm thế nào

### Buổi chiều: Index Types

| Index Type | Dùng khi |
|---|---|
| B-tree (default) | `=`, `<`, `>`, `BETWEEN`, `ORDER BY` |
| Hash | Chỉ `=` — nhanh hơn B-tree cho equality |
| GIN | JSONB, full-text search, arrays |
| Partial | WHERE condition cố định |
| Composite | Filter bằng nhiều columns |

- [ ] Partial index cho active flash sales:
  ```sql
  CREATE INDEX idx_flash_sales_active
    ON flash_sales(start_at, end_at)
    WHERE end_at > NOW();
  -- Nhỏ hơn full index, chỉ index những row cần thiết
  ```

- [ ] Composite index cho order query:
  ```sql
  -- Query: WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC
  CREATE INDEX idx_orders_user_status_date
    ON orders(user_id, status, created_at DESC);
  -- Column order trong composite index quan trọng!
  ```

**Tự hỏi:** *"Index có overhead gì? Tại sao không đặt index cho tất cả columns?"*

---

## Day 2 (Thứ 3) — N+1 Problem

### Buổi sáng: Phát hiện N+1

```
N+1 Problem:
  Query 1: GET 10 orders
  Query 2..11: GET user cho từng order
  = 1 + N = 11 queries thay vì 2

Với 100 orders → 101 queries
Với 1000 orders → 1001 queries
```

- [ ] Enable Prisma query logging
- [ ] Find N+1 trong FlashDeal:
  - Order list với user info
  - Flash sale list với product info
- [ ] Đo: 100 orders → bao nhiêu queries?

### Buổi chiều: Fix với Eager Loading

- [ ] Prisma `include`:
  ```typescript
  // N+1 (BAD):
  const orders = await prisma.order.findMany()
  for (const order of orders) {
    order.user = await prisma.user.findUnique({ where: { id: order.userId }})
  }

  // Eager loading (GOOD):
  const orders = await prisma.order.findMany({
    include: {
      user: true,
      flashSale: {
        include: { product: true }
      }
    }
  })
  ```

- [ ] Benchmark: N+1 vs include — thời gian và số queries
- [ ] Khi nào KHÔNG nên eager load (data quá lớn)?

---

## Day 3 (Thứ 4) — Query Optimization

### Buổi sáng: EXPLAIN ANALYZE

```sql
EXPLAIN ANALYZE
  SELECT o.*, u.email, p.name
  FROM orders o
  JOIN users u ON o.user_id = u.id
  JOIN flash_sales fs ON o.flash_sale_id = fs.id
  JOIN products p ON fs.product_id = p.id
  WHERE o.status = 'completed'
    AND o.created_at > NOW() - INTERVAL '7 days'
  ORDER BY o.created_at DESC
  LIMIT 20;
```

Đọc output:
```
Seq Scan            ← BAD (thường là)
Index Scan          ← GOOD
Index Only Scan     ← BEST (không cần heap)
Nested Loop         ← join nhỏ
Hash Join           ← join lớn
Sort                ← cần memory nếu không có index
```

### Buổi chiều: Pagination đúng cách

```sql
-- BAD: OFFSET pagination (chậm với large offset)
SELECT * FROM orders
ORDER BY created_at DESC
LIMIT 20 OFFSET 10000; -- phải skip 10000 rows!

-- GOOD: Cursor-based pagination
SELECT * FROM orders
WHERE created_at < $cursor  -- cursor = last item's created_at
ORDER BY created_at DESC
LIMIT 20;
```

- [ ] Implement cursor-based pagination cho order list
- [ ] Benchmark: OFFSET page 500 vs cursor pagination

---

## Day 4 (Thứ 5) — Transactions & Isolation Levels

### Buổi sáng: Transaction Isolation

```
Isolation Levels (từ yếu đến mạnh):

READ UNCOMMITTED  → Dirty read (đọc uncommitted data)
READ COMMITTED    → Default PostgreSQL — safe
REPEATABLE READ   → Phantom read có thể xảy ra
SERIALIZABLE      → Full isolation, slowest
```

- [ ] Implement order creation trong transaction:
  ```typescript
  await prisma.$transaction(async (tx) => {
    // 1. Lock inventory row
    const inventory = await tx.$queryRaw`
      SELECT * FROM inventory
      WHERE product_id = ${productId}
      FOR UPDATE  -- pessimistic lock
    `
    // 2. Check quantity
    if (inventory.quantity < 1) throw new Error('Out of stock')
    // 3. Decrease quantity
    await tx.inventory.update(...)
    // 4. Create order
    await tx.order.create(...)
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable
  })
  ```

### Buổi chiều: Deadlock

- [ ] Hiểu tại sao deadlock xảy ra:
  ```
  Transaction A: Lock row 1 → Lock row 2
  Transaction B: Lock row 2 → Lock row 1
  → DEADLOCK
  ```
- [ ] PostgreSQL tự detect và kill 1 transaction
- [ ] Application cần retry khi nhận `deadlock detected` error
- [ ] Implement retry logic cho order service

---

## Day 5 (Thứ 6) — Read Replicas & Connection Pool

### Buổi sáng: Read/Write Splitting

```
Concept:
  Primary DB: xử lý WRITEs
  Read Replica: copy của primary, xử lý READs

Lợi ích:
  - Giảm load cho primary
  - Scale reads horizontally
  - Reporting queries không ảnh hưởng production
```

- [ ] Setup read replica với Docker (2 PostgreSQL instances)
- [ ] Prisma config với multiple data sources:
  ```typescript
  // Đọc từ replica, ghi vào primary
  ```

### Buổi chiều: PgBouncer Connection Pooling

```
Vấn đề: PostgreSQL handles max ~100 connections
          1000 concurrent users = 1000 connections = CRASH

Solution: PgBouncer — connection pool middleware
          1000 app connections → 20 DB connections
```

- [ ] Setup PgBouncer trong Docker
- [ ] Benchmark: without vs with PgBouncer, 500 concurrent requests

---

## Day 6 (Thứ 7) — Database Schema Design

### Review schema FlashDeal và optimize:

- [ ] Normalization check: có data nào duplicate không?
- [ ] Đúng data types chưa? (dùng `DECIMAL` cho tiền, không phải `FLOAT`)
- [ ] Soft delete đúng cách: `deleted_at` timestamp thay vì xóa thật
- [ ] Audit trail: ai tạo, ai sửa

```sql
-- Thêm vào tất cả tables:
created_at  TIMESTAMPTZ DEFAULT NOW()
updated_at  TIMESTAMPTZ DEFAULT NOW()
created_by  UUID REFERENCES users(id)
```

---

## Day 7 (Chủ Nhật) — System Design Exercise

### Thiết kế DB cho một hệ thống mới:

**Bài tập:** Thiết kế schema cho **Twitter-like** app (không code, chỉ thiết kế):
- Users, Tweets, Follows, Likes, Retweets
- Index nào cần thiết?
- Trade-offs nào cần cân nhắc?

**Tự trả lời:**
1. Tại sao index có overhead với INSERT/UPDATE?
2. N+1 là gì? Cách detect và fix?
3. OFFSET pagination tệ hơn cursor pagination thế nào?
4. Khi nào dùng `FOR UPDATE` lock?

---

## 📚 Tài liệu tham khảo
- [Use the Index, Luke](https://use-the-index-luke.com/) — best resource về DB indexing
- [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html)
- [Prisma Read Replicas](https://www.prisma.io/docs/guides/read-replicas)
- [PgBouncer Docs](https://www.pgbouncer.org/)

---

*← [Week 04](./week-04.md) | [Week 06 →](./week-06.md)*
