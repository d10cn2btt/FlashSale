# Week 14 — Microservices Introduction

> **Phase:** 4 — Advanced Systems
> **Summary:** Không phải project nào cũng cần microservices — nhưng cần hiểu pattern để biết khi nào nên và không nên dùng. Tuần này: microservices vs monolith trade-offs, NestJS microservices, inter-service communication, và service discovery. Áp dụng: tách FlashDeal thành 2-3 services nhỏ.

---

## 🎯 Goal cuối tuần
- [ ] Hiểu khi nào nên và không nên dùng microservices
- [ ] Tách 1 module thành service riêng
- [ ] Sync và async communication giữa services
- [ ] Basic service discovery

---

## Day 1 (Thứ 2) — Monolith vs Microservices

### Buổi sáng: Trade-offs thật sự

**Monolith:**
```
Pros:
+ Đơn giản: 1 codebase, 1 deploy, 1 DB
+ Fast: function calls, no network latency
+ Easy debugging: single process
+ Easy transactions: ACID guaranteed

Cons:
- Scale: phải scale toàn bộ dù chỉ 1 module hot
- Deploy: 1 thay đổi nhỏ → deploy toàn bộ
- Tech stack: bị lock vào 1 language/framework
- Team: nhiều teams cùng code = conflicts
```

**Microservices:**
```
Pros:
+ Scale: scale từng service riêng
+ Deploy: deploy độc lập
+ Tech freedom: mỗi service có thể khác tech
+ Team: mỗi team owns 1 service

Cons:
- Network overhead: function call → HTTP/gRPC
- Distributed tracing: debug khó hơn nhiều
- Distributed transactions: không có ACID dễ dàng
- Operational complexity: nhiều services = nhiều điểm fail
```

**Rule of thumb:**
```
Start with monolith
Scale the monolith until you can't
THEN extract to microservices when you know:
  - Which parts need different scale
  - Which parts have different deploy frequency
  - Which parts owned by different teams
```

### Buổi chiều: When to Split FlashDeal?

**Module nào có thể tách:**

| Module | Reason to split | Reason to keep |
|---|---|---|
| Auth | Reusable across apps | Tightly coupled với user |
| Notification | Scale independently | Simple, not a bottleneck |
| Search | ES needs its own infra | Medium coupling |
| Order | Core business logic | Tight coupling với inventory |
| Analytics | Read-heavy, separate scale | Not latency-sensitive |

**Decision: Tách Notification Service**
- Ít coupling nhất
- Clear interface (input: event, output: notification)
- Có thể fail mà không affect core business

---

## Day 2 (Thứ 3) — NestJS Microservices

### Buổi sáng: NestJS Microservice Transports

```typescript
// Transport options:
// TCP: simple, low latency
// Redis: pub/sub, message broker
// RabbitMQ: full message broker features
// Kafka: event streaming, high throughput
// gRPC: binary protocol, strongly typed
```

**Setup notification-service:**
```typescript
// notification-service/main.ts
const app = await NestFactory.createMicroservice(AppModule, {
  transport: Transport.REDIS,
  options: {
    host: 'redis',
    port: 6379,
  }
})
await app.listen()
```

**Order service sends message:**
```typescript
// order-service
@Injectable()
export class OrderService {
  constructor(
    @Inject('NOTIFICATION_SERVICE')
    private notificationClient: ClientProxy
  ) {}

  async createOrder(dto: CreateOrderDto) {
    const order = await this.processOrder(dto)
    
    // Async: fire and forget
    this.notificationClient.emit('order.created', {
      orderId: order.id,
      userId: order.userId,
    })
    
    return order
  }
}
```

### Buổi chiều: Message Patterns

**Event (fire and forget):**
```typescript
// Publisher
this.client.emit('order.created', payload)

// Subscriber
@EventPattern('order.created')
async handleOrderCreated(data: OrderCreatedPayload) {
  await this.sendEmail(data)
}
```

**Request-Response (sync):**
```typescript
// Caller
const result = await this.client.send('user.get', { id: userId }).toPromise()

// Handler
@MessagePattern('user.get')
async getUser(data: { id: number }) {
  return this.userService.findById(data.id)
}
```

---

## Day 3 (Thứ 4) — Service Communication Patterns

### Buổi sáng: Sync vs Async

```
Sync (Request-Response):
  Service A → Service B → Response
  + Immediate result
  + Simple to understand
  - Coupling: A waiting for B
  - Cascading failures: B down → A down

Async (Event-driven):
  Service A → emit event → Service B processes later
  + Loose coupling
  + Resilient: B down doesn't affect A
  - Eventual consistency
  - Harder to trace
```

### Buổi chiều: Resilience Patterns

**Problem:** Notification service down → order creation fail?

```typescript
// Pattern: Best-effort async
async createOrder(dto) {
  const order = await this.processOrder(dto)
  
  try {
    // Try to notify, but don't fail if it doesn't work
    this.notificationClient.emit('order.created', order)
  } catch (e) {
    // Log but don't fail the order
    this.logger.error('Failed to emit notification event', e)
  }
  
  return order  // Order still succeeds
}
```

- [ ] Implement circuit breaker cho inter-service calls
- [ ] Store pending notifications trong DB nếu service unavailable

---

## Day 4 (Thứ 5) — API Gateway Pattern

### Buổi sáng: Tại sao cần API Gateway?

```
Without Gateway:
  Client → Order Service: http://order-service:3001
  Client → User Service: http://user-service:3002
  Client → Search Service: http://search-service:3003
  → Client phải biết địa chỉ từng service
  → Auth check ở mỗi service
  → CORS ở mỗi service

With API Gateway:
  Client → Gateway: https://api.flashdeal.com
  Gateway → Order Service (internal)
  Gateway → User Service (internal)
  Gateway → Search Service (internal)
  → Single entry point
  → Auth centralized
  → Load balancing, rate limiting, logging
```

### Buổi chiều: Simple API Gateway với NestJS

```typescript
// Gateway proxies requests to appropriate services
@Controller('orders')
export class OrdersGateway {
  constructor(
    @Inject('ORDER_SERVICE') private orderService: ClientProxy
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard) // Auth at gateway level
  createOrder(@Body() dto, @CurrentUser() user) {
    return this.orderService
      .send('order.create', { ...dto, userId: user.id })
      .toPromise()
  }
}
```

- [ ] Setup basic API Gateway
- [ ] Centralized auth
- [ ] Request aggregation (1 request → 2 services → merge response)

---

## Day 5 (Thứ 6) — Data Management

### Buổi sáng: Database per Service

```
Microservices principle: mỗi service có DB riêng
Problem: làm sao query data across services?

Option 1: API calls between services
Option 2: Event-driven data sync
Option 3: Shared read DB (reporting)
```

**FlashDeal:**
```
notification-service DB: chỉ lưu notifications
order-service DB: orders
user-service DB: users

Notification cần user.email:
  Option A: Call user-service API
  Option B: notification-service lưu copy của user.email khi user.registered event
```

### Buổi chiều: Eventual Consistency

- [ ] Document: mỗi service owns gì?
- [ ] Implement data sync qua events:
  - `user.email.updated` → notification-service updates local copy
- [ ] Test: user update email → notification được gửi với email mới

---

## Day 6 (Thứ 7) — Observability trong Microservices

### Distributed Tracing trở nên critical:

```
Request: POST /orders
  → Gateway [span 1: 200ms]
      → Order Service [span 2: 150ms]
          → DB Query [span 3: 50ms]
      → Notification emit [span 4: 5ms]
          → Notification Service [span 5: 30ms]
              → Email [span 6: 25ms]
```

- [ ] Propagate trace context giữa services:
  - Request header: `X-Trace-ID`, `X-Span-ID`
  - Downstream services attach spans
- [ ] View full trace trong Grafana Tempo

---

## Day 7 (Chủ Nhật) — Reflection

### Câu hỏi quan trọng:

> Với FlashDeal ở scale hiện tại, microservices có thật sự cần thiết không?

**Trả lời thật sự:**
- Với 1 dev, team nhỏ → microservices là over-engineering
- Monolith với tốt codebase structure là đủ
- Microservices chỉ worth khi: team lớn, scale khác nhau, deploy độc lập thật sự cần

**Document: tradeoff analysis**

---

## 📚 Tài liệu tham khảo
- [NestJS Microservices](https://docs.nestjs.com/microservices/basics)
- [Martin Fowler — Microservices](https://martinfowler.com/articles/microservices.html)
- [Monolith First — Martin Fowler](https://martinfowler.com/bliki/MonolithFirst.html)

---

*← [Week 13](./week-13.md) | [Week 15 →](./week-15.md)*
