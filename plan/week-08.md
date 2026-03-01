# Week 08 — API Design & Scalability Patterns

> **Phase:** 2 — System Design
> **Summary:** Thiết kế API tốt là kỹ năng sống còn của backend dev. Tuần này: REST best practices, versioning strategies, pagination patterns, rate limiting, idempotency, và horizontal scaling concepts. Kết thúc Phase 2 với tư duy "design for scale" được internalize.

---

## 🎯 Goal cuối tuần
- [ ] FlashDeal API đạt REST best practices
- [ ] API versioning strategy implemented
- [ ] 3 pagination patterns hoạt động + benchmarked
- [ ] Idempotency key cho order creation
- [ ] Horizontal scaling concept understood

---

## Day 1 (Thứ 2) — REST Best Practices

### Buổi sáng: Audit API hiện tại

**Review FlashDeal API theo checklist:**

| Rule | Ví dụ đúng | Ví dụ sai |
|---|---|---|
| Nouns, not verbs | `GET /orders` | `GET /getOrders` |
| Plural resources | `/products` | `/product` |
| Nested resources | `/users/:id/orders` | `/getUserOrders/:id` |
| Correct HTTP methods | `DELETE /products/:id` | `POST /deleteProduct` |
| Status codes đúng | `201 Created` for POST | `200 OK` for create |
| Consistent naming | `snake_case` hoặc `camelCase` (chọn 1) | Mixed |

**HTTP Status Code guide:**
```
2xx: Success
  200 OK           - GET, PUT, PATCH success
  201 Created      - POST success (new resource)
  204 No Content   - DELETE success

4xx: Client Error
  400 Bad Request  - Invalid input
  401 Unauthorized - Not authenticated
  403 Forbidden    - Authenticated but no permission
  404 Not Found    - Resource not found
  409 Conflict     - Duplicate resource
  422 Unprocessable - Validation error
  429 Too Many     - Rate limited

5xx: Server Error
  500 Internal     - Unexpected error
  503 Unavailable  - Service down/overloaded
```

### Buổi chiều: Fix API theo best practices

- [ ] Audit và fix tất cả endpoints
- [ ] Consistent error response format
- [ ] Consistent success response format:
  ```json
  // List:
  { "data": [...], "meta": { "total": 100, "page": 1 } }

  // Single:
  { "data": { ... } }

  // Error:
  { "error": { "code": "OUT_OF_STOCK", "message": "..." } }
  ```

---

## Day 2 (Thứ 3) — API Versioning

### Buổi sáng: Versioning Strategies

| Strategy | URL | Header | Pros | Cons |
|---|---|---|---|---|
| **URL Path** | `/v1/products` | - | Explicit, cacheable | URL pollution |
| **Header** | `/products` | `API-Version: 1` | Clean URLs | Less visible |
| **Query Param** | `/products?v=1` | - | Simple | Can be ignored |

**Recommended: URL Path cho public APIs**

### Buổi chiều: Implement Versioning

- [ ] Tạo `/api/v1/` prefix cho tất cả routes
- [ ] Setup structure cho future v2:
  ```
  src/modules/
    v1/
      course/
      auth/
    v2/ (future)
      course/
  ```
- [ ] Version NestJS controllers:
  ```typescript
  @Controller({ path: 'products', version: '1' })
  ```
- [ ] Deprecation strategy: `Deprecation: true` header khi endpoint sắp bị remove

---

## Day 3 (Thứ 4) — Pagination Patterns

### Buổi sáng: 3 Patterns

**1. Offset Pagination (Simple):**
```sql
SELECT * FROM orders
LIMIT 20 OFFSET 100  -- page 6

// Problem: khi data thay đổi giữa pages → duplicate/skip
// Problem: OFFSET 1000000 → full table scan
```

**2. Cursor-based Pagination (Recommended):**
```sql
SELECT * FROM orders
WHERE id > :last_id
ORDER BY id
LIMIT 20

// Dùng ID của item cuối cùng làm cursor
// Fast, consistent, không bị duplicate
// Nhưng không thể jump to page 50
```

**3. Keyset Pagination (cho sorted data):**
```sql
SELECT * FROM orders
WHERE (created_at, id) < (:last_created_at, :last_id)
ORDER BY created_at DESC, id DESC
LIMIT 20
```

### Buổi chiều: Benchmark

- [ ] Implement cả 3 trên `GET /orders`
- [ ] Benchmark với 1M orders:
  - Offset page 1: ?ms
  - Offset page 50000: ?ms (SLOW!)
  - Cursor page 1: ?ms
  - Cursor "page 50000": ?ms (FAST, cùng tốc độ)
- [ ] Document results

---

## Day 4 (Thứ 5) — Idempotency

### Buổi sáng: Idempotency Key

**Problem:**
```
User click "Mua ngay"
→ Network timeout (user không biết có succeed không)
→ User click lại
→ 2 orders được tạo → 2 lần thanh toán ← BUG
```

**Solution: Idempotency Key**
```
Client gửi: X-Idempotency-Key: uuid-v4-unique-per-request

Server:
  1. Check key trong Redis → đã xử lý? Return cached response
  2. Chưa xử lý → process → lưu response vào Redis với key
  3. Return response

Retry với cùng key → nhận lại cùng response (không tạo order thứ 2)
```

### Buổi chiều: Implement

- [ ] `IdempotencyMiddleware`:
  - Extract `X-Idempotency-Key` header
  - Check Redis
  - Store response sau khi xử lý
- [ ] Apply cho `POST /orders`
- [ ] Test: gửi request với cùng key 5 lần → chỉ 1 order được tạo

---

## Day 5 (Thứ 6) — Horizontal Scaling Concepts

### Buổi sáng: Stateless Architecture

```
Stateless server có thể scale horizontally:
  Request → Load Balancer → Server 1
                          → Server 2
                          → Server 3

Yêu cầu: mỗi server phải không lưu state locally
  - Session → Redis (shared)
  - Files upload → S3/MinIO (shared)
  - Cache → Redis (shared)
  - Queue → Redis/BullMQ (shared)
```

**Audit FlashDeal:**
- [ ] Kiểm tra có chỗ nào lưu state trong memory không?
- [ ] Files upload → setup MinIO (local S3)
- [ ] Verify: chạy 2 instances → requests có thể đến bất kỳ instance nào

### Buổi chiều: Load Testing

- [ ] Install k6
- [ ] Viết load test script:
  ```javascript
  // k6 script
  import http from 'k6/http'

  export const options = {
    stages: [
      { duration: '30s', target: 50 },   // ramp up
      { duration: '1m', target: 100 },   // steady state
      { duration: '30s', target: 0 },    // ramp down
    ],
  }

  export default function() {
    http.get('http://localhost:3000/flash-sales/active')
  }
  ```
- [ ] Chạy test → observe: RPS, latency percentiles (p50, p95, p99), error rate

---

## Day 6 (Thứ 7) — API Documentation

### Buổi sáng: Swagger/OpenAPI

- [ ] Setup `@nestjs/swagger` cho FlashDeal
- [ ] Document tất cả endpoints với:
  - Description
  - Request body schema
  - Response schema
  - Error responses
  - Auth requirement

```typescript
@ApiOperation({ summary: 'Create an order for a flash sale' })
@ApiResponse({ status: 201, type: OrderResponseDto })
@ApiResponse({ status: 409, description: 'Out of stock' })
@ApiBearerAuth()
@Post()
async createOrder(@Body() dto: CreateOrderDto) {}
```

### Buổi chiều: Postman Collection

- [ ] Export Swagger → import vào Postman
- [ ] Setup environment variables (baseUrl, token)
- [ ] Write Postman tests cho critical paths

---

## Day 7 (Chủ Nhật) — Phase 2 Retrospective

### Đã học Phase 2:
- Database indexing, EXPLAIN ANALYZE, N+1
- Caching patterns: Cache-Aside, Write-Through, Stampede fix
- Redis data structures
- Queue patterns, Choreography vs Orchestration
- REST best practices, Versioning, Pagination, Idempotency
- Horizontal scaling concepts

### System Design Question:

> Design API cho một URL shortener (bit.ly) xử lý 100M requests/ngày:
> - `POST /shorten` → return short URL
> - `GET /:code` → redirect to original URL (99% of traffic)
>
> Design: caching strategy, DB schema, scaling approach.

---

## 📚 Tài liệu tham khảo
- [REST API Design Best Practices](https://restfulapi.net/)
- [Stripe Idempotency](https://stripe.com/blog/idempotency)
- [k6 Load Testing](https://k6.io/docs/)
- [Cursor Pagination](https://jsonapi.org/profiles/ethanresnick/cursor-pagination/)

---

*← [Week 07](./week-07.md) | [Week 09 →](./week-09.md)*
