# AI Context — FlashDeal Project

> Paste file này vào đầu mỗi conversation mới với AI.
> Cập nhật "Current Status" mỗi khi hoàn thành 1 tuần.

---

## Về tao

- Laravel dev đang chuyển sang NestJS + NextJS
- Mục tiêu: hiểu tư duy hệ thống, không chỉ biết code
- Làm việc theo Specs-Driven Development + Co-pilot style (tự làm trước, AI hỗ trợ)

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

## Take note trouble shoot
Hãy take note các lỗi mà tao gặp phải vào 1 file trouble shoot tương ứng của backend & frontend nhé
Nhớ take note kĩ, Nguyên nhân, solution, wh

## Current Status

**Đang ở:** Week ___ / Day ___

**Đã hoàn thành:**
- [ ] Week 1: Auth System
- [ ] Week 2: Core Features + Race Condition
- [ ] Week 3: Queue + Async
- [ ] Week 4: Testing + Deploy
- *(cập nhật khi xong)*

**Task hôm nay:** [điền vào trước khi paste]

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
