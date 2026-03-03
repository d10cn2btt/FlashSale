# Week 07 — Queue & Event-Driven Architecture

> **Phase:** 2 — System Design
> **Summary:** Đi sâu hơn vào async processing và event-driven architecture. Học sự khác biệt giữa Queue, Pub/Sub, và Event Streaming. Implement event sourcing cơ bản, và hiểu khi nào nên dùng synchronous vs asynchronous communication.

---

## 🎯 Goal cuối tuần
- [ ] Hiểu Queue vs Pub/Sub vs Event Stream
- [ ] Implement Saga pattern cho order flow
- [ ] Dead Letter Queue với alerting
- [ ] Idempotent job processing

---

## Day 1 (Thứ 2) — Messaging Patterns

### Buổi sáng: 3 Patterns cốt lõi

**1. Message Queue (Point-to-Point)**
```
Producer → [Queue] → Consumer (chỉ 1)
- Message bị consume thì mất
- Đảm bảo delivery (at-least-once)
- Dùng khi: task processing (gửi email, xử lý image)
Tool: BullMQ, RabbitMQ, SQS
```

**2. Pub/Sub**
```
Publisher → [Topic] → Consumer 1
                    → Consumer 2
                    → Consumer 3
- 1 message, nhiều subscribers nhận
- Fire and forget (thường)
- Dùng khi: notification, live updates, loose coupling
Tool: Redis Pub/Sub, Google Pub/Sub, SNS
```

**3. Event Stream**
```
Producer → [Log/Stream] → Consumer A (offset 0)
                        → Consumer B (offset 50)
- Messages persist (có history)
- Consumer tự quản lý offset (đọc lại được)
- Dùng khi: audit log, event sourcing, analytics
Tool: Kafka, Redis Streams, Kinesis
```

### Buổi chiều: Apply vào FlashDeal

- [ ] Audit log với Redis Streams: mọi order event được ghi lại
- [ ] Notification với Pub/Sub: flash sale start event
- [ ] Background tasks với BullMQ Queue: emails, analytics

---

## Day 2 (Thứ 3) — Saga Pattern

### Buổi sáng: Tại sao cần Saga?

**Vấn đề với distributed transactions:**
```
Order Flow:
1. Create order record (DB)
2. Decrease inventory (DB)
3. Charge payment (external API)
4. Send notification (queue)

Nếu step 3 fail → step 1, 2 đã xảy ra → inconsistent!
```

**Saga: chuỗi transactions với compensating actions**
```
Step 1: Create order → Compensate: Cancel order
Step 2: Reserve inventory → Compensate: Release inventory
Step 3: Charge payment → Compensate: Refund
Step 4: Send notification → (best effort, không compensate)

Nếu step 3 fail:
  → Trigger compensate step 2 (release inventory)
  → Trigger compensate step 1 (cancel order)
```

### Buổi chiều: Implement Choreography-based Saga

```
Choreography: mỗi service listen events và react
(không có central coordinator)

order.created → inventory service → inventory.reserved
inventory.reserved → payment service → payment.charged
payment.charged → notification service → notification.sent

payment.failed → inventory service → inventory.released
inventory.released → order service → order.cancelled
```

- [ ] Implement với Redis Pub/Sub:
  - `OrderService` emit `order.created`
  - `InventoryService` listen → reserve → emit `inventory.reserved`
  - `PaymentService` (mock) listen → simulate → emit success/fail
- [ ] Test: simulate payment failure → quan sát compensation chain

---

## Day 3 (Thứ 4) — Idempotency

### Buổi sáng: Idempotency là gì?

```
Idempotent operation: gọi nhiều lần = gọi 1 lần

Tại sao cần:
- Network retry: request gửi nhưng response bị drop
- Queue retry: job fail và được retry
- User double-click

Kết quả nếu không idempotent:
- Double charges
- Duplicate emails
- Overselling
```

### Buổi chiều: Implement Idempotency Key

- [ ] `POST /orders` yêu cầu `Idempotency-Key` header
  ```typescript
  // Kiểm tra Redis: key này đã xử lý chưa?
  const existing = await redis.get(`idempotency:${key}`)
  if (existing) return JSON.parse(existing) // return cached result

  // Process order
  const result = await processOrder(...)

  // Cache result với TTL 24h
  await redis.set(`idempotency:${key}`, JSON.stringify(result), 'EX', 86400)
  return result
  ```

- [ ] Email job idempotency:
  - `jobId` = hash của `(orderId, jobType)`
  - Check DB trước khi gửi: đã gửi email này chưa?

---

## Day 4 (Thứ 5) — Dead Letter Queue & Alerting

### Buổi sáng: DLQ Architecture

```
Job fails → Retry (3 lần) → DLQ

DLQ xử lý:
1. Log chi tiết error
2. Notify team (Slack/email)
3. Store for manual review
4. Auto-retry sau 1 giờ (với exponential backoff)
```

- [ ] Implement DLQ handler:
  ```typescript
  @OnQueueFailed()
  async onJobFailed(job: Job, error: Error) {
    if (job.attemptsMade >= job.opts.attempts) {
      // Move to DLQ
      await this.dlqService.add(job, error)
      // Alert
      await this.alertService.notify(`Job ${job.name} failed permanently`)
    }
  }
  ```

### Buổi chiều: Retry Strategies

```
Immediate retry: retry ngay → thường fail cùng lý do
Fixed delay: retry sau Ns → đơn giản
Exponential backoff: 1s, 2s, 4s, 8s... → tốt nhất
Jitter: random delay để tránh thundering herd
```

- [ ] Config BullMQ với exponential backoff + jitter:
  ```typescript
  {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    // Jitter: delay * (0.5 + random * 0.5)
  }
  ```

---

## Day 5 (Thứ 6) — Event Sourcing Cơ Bản

### Buổi sáng: Từ "lưu state" sang "lưu events"

```
Traditional: Lưu current state
  orders table: { id, status: 'completed', ... }

Event Sourcing: Lưu history of events
  order_events:
    { id, type: 'OrderCreated', payload: {...}, timestamp }
    { id, type: 'InventoryReserved', payload: {...}, timestamp }
    { id, type: 'PaymentCharged', payload: {...}, timestamp }
    { id, type: 'OrderCompleted', payload: {...}, timestamp }

Current state = replay all events
```

### Buổi chiều: Implement Order Event Log

- [ ] `order_events` table
- [ ] Mỗi state change → append event (không update)
- [ ] Query current state bằng cách aggregate events
- [ ] Admin timeline viewer cho một order: thấy toàn bộ history

---

## Day 6 (Thứ 7) — Circuit Breaker Pattern

### Buổi sáng: Tại sao cần Circuit Breaker?

```
Cascading failures:
Payment Service slow → Order Service chờ → Timeout → 
Thread pool full → Order Service down → 
User Service down → App tê liệt
```

**Circuit Breaker states:**
```
CLOSED: requests đi bình thường
OPEN: requests fail fast (không chờ), return error ngay
HALF-OPEN: thử 1 request → nếu OK → CLOSED, nếu fail → OPEN
```

### Buổi chiều: Implement với `cockatiel`

- [ ] Install `cockatiel` (circuit breaker library cho Node)
- [ ] Wrap payment service call với circuit breaker
- [ ] Test: make payment service fail → circuit opens → fast fail → circuit recovers

---

## Day 7 (Chủ Nhật) — Architecture Review

### Vẽ event flow của FlashDeal:

```
User → API → [Events] → Services
             order.created → inventory, payment, notification
             payment.failed → inventory (compensate), order (cancel)
             flash_sale.started → notification (broadcast)
```

**Tự trả lời:**
1. Saga choreography khác orchestration thế nào?
2. Idempotency key cần lưu ở đâu? Tại sao Redis?
3. Circuit breaker closed vs open vs half-open?
4. Khi nào nên dùng event sourcing?

---

## 📚 Tài liệu tham khảo
- [Saga Pattern — Chris Richardson](https://microservices.io/patterns/data/saga.html)
- [Idempotency Keys](https://stripe.com/blog/idempotency) — Stripe blog
- [Circuit Breaker — Martin Fowler](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Event Sourcing — Martin Fowler](https://martinfowler.com/eaaDev/EventSourcing.html)

---

*← [Week 06](./week-06.md) | [Week 08 →](./week-08.md)*
