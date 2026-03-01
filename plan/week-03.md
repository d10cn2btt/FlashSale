# Week 03 — Queue, Async Processing & Frontend Polish

> **Phase:** 1 — NestJS + NextJS Foundation
> **Summary:** Tách các tác vụ chậm (gửi email, cập nhật analytics, notification) ra khỏi request-response cycle bằng BullMQ. Hoàn thiện NextJS frontend với real-time updates. Học cách thiết kế hệ thống async đúng cách — thứ quyết định UX của ứng dụng ở scale lớn.

---

## 🎯 Goal cuối tuần
- [ ] BullMQ queue hoạt động với ít nhất 3 loại job
- [ ] Order flow: user không phải chờ email gửi
- [ ] Frontend: real-time order status (polling hoặc SSE)
- [ ] Job retry & failure handling hoạt động

---

## Day 1 (Thứ 2) — Queue Architecture

### Buổi sáng: Hiểu tại sao cần Queue

**Vấn đề hiện tại của order flow:**
```
User click "Mua ngay"
  → API xử lý order (10ms)
  → Gửi email (2000ms) ← USER ĐANG CHỜ
  → Cập nhật analytics (500ms) ← USER ĐANG CHỜ
  → Push notification (300ms) ← USER ĐANG CHỜ
  → Response (2810ms total) ← QUÁ CHẬM
```

**Sau khi có Queue:**
```
User click "Mua ngay"
  → API xử lý order (10ms)
  → Push jobs vào queue (5ms) ← fire and forget
  → Response (15ms) ← NHANH

Background workers:
  → Process email job
  → Process analytics job
  → Process notification job
```

### Buổi chiều: Setup BullMQ

- [ ] Install: `@nestjs/bull`, `bull`, `ioredis`
- [ ] `QueueModule` global với Redis connection
- [ ] Định nghĩa các queues:
  - `email-queue`
  - `notification-queue`
  - `analytics-queue`
- [ ] `BullBoard` UI để xem queue status (optional nhưng useful)

**Tự hỏi:** *"Queue khác Event Emitter thế nào? Khi nào dùng cái nào?"*

---

## Day 2 (Thứ 3) — Email Queue

### Buổi sáng: Email Service + Job

- [ ] Setup Nodemailer với MailHog (local fake SMTP trong Docker)
- [ ] `EmailService.sendOrderConfirmation(order)`
- [ ] `EmailJob` producer — push job khi order tạo thành công:
  ```typescript
  await this.emailQueue.add('order-confirmation', {
    orderId: order.id,
    userEmail: user.email,
    orderDetails: order,
  }, {
    attempts: 3,           // retry 3 lần nếu fail
    backoff: {
      type: 'exponential', // wait 1s, 2s, 4s giữa retries
      delay: 1000,
    },
  });
  ```

### Buổi chiều: Email Consumer (Processor)

- [ ] `@Processor('email-queue')` worker
- [ ] `@Process('order-confirmation')` handler
- [ ] Test: tạo order → email xuất hiện trong MailHog

**Simulate failure:**
- [ ] Làm SMTP fail → quan sát retry behavior
- [ ] Sau 3 lần fail → job vào "failed" queue
- [ ] Implement `onFailed` event handler — log + alert

**Tự hỏi:** *"Job idempotency là gì? Nếu worker crash giữa chừng, job có bị xử lý 2 lần không?"*

---

## Day 3 (Thứ 4) — Notification & Analytics

### Buổi sáng: In-App Notification

- [ ] `notifications` table trong DB
- [ ] Push thông báo khi:
  - Order thành công
  - Flash sale sắp bắt đầu (30 phút trước)
- [ ] `GET /notifications` — list unread notifications
- [ ] `PATCH /notifications/:id/read` — đánh dấu đã đọc

### Buổi chiều: Analytics Queue

- [ ] Tạo `analytics-queue`
- [ ] Track events:
  - `product.view`
  - `flash_sale.join`
  - `order.created`
  - `order.failed`
- [ ] Aggregation mỗi 5 phút (scheduled job với `@Cron`)
- [ ] `GET /admin/analytics` — summary

**Scheduled Jobs:**
```typescript
@Cron('*/5 * * * *') // mỗi 5 phút
async aggregateAnalytics() {
  // Process raw events → aggregate metrics
}
```

---

## Day 4 (Thứ 5) — Real-time & SSE

### Buổi sáng: Server-Sent Events (SSE)

```
Tại sao SSE thay vì WebSocket?
- SSE: 1 chiều (server → client), đơn giản hơn, HTTP
- WebSocket: 2 chiều, complex hơn
- Cho order status update → SSE là đủ
```

- [ ] `GET /orders/:id/status-stream` → SSE endpoint
  ```typescript
  @Sse('orders/:id/status-stream')
  orderStatus(@Param('id') id: string): Observable<MessageEvent> {
    // Poll DB mỗi 2 giây, emit khi status change
  }
  ```

### Buổi chiều: NextJS SSE Client

- [ ] Hook `useOrderStatus(orderId)`:
  ```typescript
  // Dùng EventSource API
  // Update UI khi nhận event
  ```
- [ ] Order status page với live update:
  - ⏳ Processing
  - ✅ Confirmed
  - 📧 Email sent
  - ❌ Failed

---

## Day 5 (Thứ 6) — Queue Monitoring & Error Handling

### Buổi sáng: BullBoard Dashboard

- [ ] Setup `@bull-board/express` hoặc `@bull-board/nestjs`
- [ ] Xem được:
  - Active jobs
  - Completed jobs
  - Failed jobs
  - Job details + stacktrace

### Buổi chiều: Dead Letter Queue (DLQ)

- [ ] Jobs fail sau 3 retries → move to DLQ
- [ ] Admin endpoint để:
  - View failed jobs
  - Retry failed jobs manually
  - Clear DLQ

```typescript
@Get('admin/queue/failed')
async getFailedJobs() {}

@Post('admin/queue/retry/:jobId')
async retryJob(@Param('jobId') jobId: string) {}
```

**Tự hỏi:** *"Khi nào nên retry, khi nào nên drop job? Email fail vs payment fail xử lý khác nhau thế nào?"*

---

## Day 6 (Thứ 7) — Frontend Polish

### Buổi sáng: NextJS Optimization
- [ ] Loading states cho tất cả actions
- [ ] Optimistic UI cho wishlist/bookmark
- [ ] Error boundaries
- [ ] Toast notifications

### Buổi chiều: Admin Dashboard
- [ ] Flash Sale management
- [ ] Order listing với filters
- [ ] Queue status widget
- [ ] Basic analytics chart (dùng recharts)

---

## Day 7 (Chủ Nhật) — Architecture Review

### Vẽ lại full system:

```
Browser ──── NextJS ───┬─── AUTH API ──── JWT Guard
                       │
                       ├─── PRODUCT API ──── Cache ──── Redis
                       │                         └──── PostgreSQL
                       │
                       └─── ORDER API ──── Distributed Lock ──── Redis
                                    │
                                    └──── Queue ──── email-queue ──── MailHog
                                                 ├── notif-queue
                                                 └── analytics-queue
```

### Câu hỏi tự trả lời:
1. Queue với 1 worker vs nhiều worker — concurrency xử lý thế nào?
2. Nếu Redis down, queue có bị mất job không?
3. SSE khác polling thế nào? Khi nào dùng WebSocket?
4. Job idempotency: làm thế nào để đảm bảo email chỉ gửi 1 lần dù job chạy nhiều lần?

---

## 📚 Tài liệu tham khảo
- [BullMQ Docs](https://docs.bullmq.io/)
- [NestJS Queues](https://docs.nestjs.com/techniques/queues)
- [SSE vs WebSocket — When to use what](https://dev.to/dcodeio/sse-vs-websockets-a-comprehensive-guide)
- [Job Queue Best Practices](https://blog.bullmq.io/patterns-for-job-queuing-with-bullmq)

---

*← [Week 02](./week-02.md) | [Week 04 →](./week-04.md)*
