## Project: FlashDeal (Mini Flash Sale Platform)

## Tech Stack
- Backend: NestJS + Prisma + PostgreSQL
- Cache: Redis (cache + distributed lock + pub/sub)
- Queue: BullMQ
- Frontend: NextJS + TailwindCSS
- Auth: JWT + Refresh Token + Redis Blacklist
- Monitoring: Prometheus + Grafana + Loki (Week 12+)
- DevOps:     Docker Compose (local), GitHub Actions CI/CD
- Search:     Elasticsearch (Week 13+)

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
- Khi tao gặp lỗi, hãy take note vào `docs/troubleshoot-backend.md` hoặc `docs/troubleshoot-frontend.md`
- Format: Nguyên nhân / Solution / Why

### Kỹ thuật mới
- Khi dùng kỹ thuật NestJS mới → take note vào `docs/nestjs.md`
- Khi dùng kỹ thuật NextJS mới → take note vào `docs/nextjs.md`
- Format: giải thích rõ + code ví dụ + use case