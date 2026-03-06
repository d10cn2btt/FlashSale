# FlashDeal — Claude Context

## Project
Mini Flash Sale Platform — dùng để học NestJS, system design, scaling.

## Tech Stack
- Backend: NestJS + Prisma + PostgreSQL
- Cache: Redis (cache + distributed lock + pub/sub)
- Queue: BullMQ
- Frontend: NextJS + TailwindCSS
- Auth: JWT + Refresh Token + Redis Blacklist
- Monitoring: Prometheus + Grafana + Loki (Week 12+)
- DevOps: Docker Compose (local), GitHub Actions CI/CD
- Search: Elasticsearch (Week 13+)

## API Conventions
- Error format: `{ error: { code: string, message: string } }`
- Success format: `{ data: T }` hoặc `{ data: T[], meta: { total, page } }`
- API prefix: `/api/v1/`
- Auth: Bearer JWT trong Authorization header
- Soft delete: `deletedAt` timestamp
- All tables có: `createdAt`, `updatedAt`

## Developer Profile
- Laravel dev đang chuyển sang NestJS + NextJS
- Mục tiêu: hiểu tư duy hệ thống, không chỉ biết code
- Làm việc theo Specs-Driven Development + Co-pilot style

## Communication Style
- Hướng dẫn từng bước một, không làm hết một lúc
- Giải thích lý do đằng sau mỗi bước
- Trả lời bằng tiếng Việt

## Note-taking Rules

### Troubleshoot
- Khi gặp lỗi → take note vào `docs/troubleshoot-backend.md` hoặc `docs/troubleshoot-frontend.md`
- Format: Nguyên nhân / Solution / Why

### Kỹ thuật mới
- Khi dùng kỹ thuật NestJS mới → take note vào `docs/nestjs.md`
- Khi dùng kỹ thuật NextJS mới → take note vào `docs/nextjs.md`
- Format: giải thích rõ + code ví dụ + use case

## Patterns hay dùng
| Pattern | Mô tả |
|---|---|
| **Facade** | Bọc subsystem sau interface đơn giản |
| **Encapsulation** | Tập trung key generation / logic lặp lại vào 1 chỗ |
| **Extract Method** | Method dài → tách thành method nhỏ, mỗi cái 1 việc |
| **Fail-Closed** | Khi dependency down → từ chối request |
| **Minimize try/catch scope** | `try/catch` chỉ bọc đúng I/O call |
| **Error Factory** | Tập trung error codes/messages vào `common/errors/` |

Chi tiết: `plan/patterns.md`

## Learning Plan
Full plan: `plan/` — 18 tuần, chia 5 phase.
Current status: `plan/AI-CONTEXT.md`
