# FlashDeal

Mini Flash Sale Platform — platform bán hàng giảm giá trong thời gian giới hạn.

Dự án học tập tập trung vào các vấn đề scaling thực tế: race condition, caching, distributed lock, queue, horizontal scaling.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | NestJS + Prisma + PostgreSQL |
| Frontend | NextJS + TailwindCSS |
| Cache / Lock / Queue | Redis + BullMQ |
| Auth | JWT + Refresh Token + Redis Blacklist |
| DevOps | Docker Compose |
| Monitoring | Prometheus + Grafana (Week 12+) |
| Search | Elasticsearch (Week 13+) |

---

## Yêu cầu

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Node.js 20+
- npm 10+

---

## Cách chạy local

### 1. Clone repo

```bash
git clone <repo-url>
cd FlashSale
```

### 2. Khởi động infrastructure (PostgreSQL, Redis, pgAdmin, MailHog)

```bash
docker compose up -d
```

### 3. Setup Backend

```bash
cd backend
npm install

# Copy env
cp .env.example .env  # hoặc tạo file .env theo mẫu bên dưới

# Chạy migration
npx prisma migrate dev

# Seed data (optional)
npx prisma db seed

# Start dev server
npm run start:dev
```

Backend chạy tại: `http://localhost:5000`

### 4. Setup Frontend

```bash
cd frontend
npm install

# Copy env
cp .env.example .env.local  # hoặc tạo file .env.local theo mẫu bên dưới

# Start dev server
npm run dev
```

Frontend chạy tại: `http://localhost:3000`

---

## Biến môi trường

### Backend (`backend/.env`)

```env
DATABASE_URL="postgresql://flashdeal:flashdeal123@localhost:5432/flashdeal_db"
REDIS_URL="redis://localhost:6379"

JWT_SECRET="your-jwt-secret"
JWT_REFRESH_SECRET="your-jwt-refresh-secret"
JWT_EXPIRES_IN="15m"

PORT=5000
FRONTEND_URL="http://localhost:3000"
```

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL="http://localhost:5000/api/v1"
```

---

## Services khi chạy Docker Compose

| Service | URL | Thông tin |
|---|---|---|
| PostgreSQL | `localhost:5432` | user: `flashdeal` / pass: `flashdeal123` |
| Redis | `localhost:6379` | — |
| pgAdmin | `http://localhost:5050` | email: `admin@flashdeal.com` / pass: `admin123` |
| MailHog (SMTP) | `http://localhost:8025` | Fake email client |

---

## Cấu trúc thư mục

```
FlashSale/
├── backend/          # NestJS API
│   ├── prisma/       # Schema + migrations + seed
│   └── src/
│       ├── common/   # Prisma, Redis, Error factories
│       └── modules/  # auth, user, ...
├── frontend/         # NextJS app
│   ├── app/          # Pages (App Router)
│   ├── contexts/     # AuthContext
│   └── lib/api/      # Axios client + interceptors
├── docs/             # Ghi chú kỹ thuật + troubleshoot
├── plan/             # Learning plan 18 tuần
└── docker-compose.yml
```

---

## API Endpoints

### Auth

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | Đăng ký tài khoản |
| POST | `/api/v1/auth/login` | Public | Đăng nhập, trả accessToken + set refreshToken cookie |
| POST | `/api/v1/auth/logout` | Bearer | Đăng xuất, blacklist token |
| POST | `/api/v1/auth/refresh` | Cookie | Refresh accessToken |
| GET | `/api/v1/auth/me` | Bearer | Lấy thông tin user hiện tại |

### Response format

```json
// Success
{ "data": { ... } }

// Error
{ "error": { "code": "ERROR_CODE", "message": "Mô tả lỗi" } }
```

---

## Learning Plan

18 tuần — chi tiết tại `plan/`

| Phase | Tuần | Nội dung |
|---|---|---|
| Phase 1 | 1-4 | NestJS + NextJS Foundation |
| Phase 2 | 5-8 | System Design — DB, Cache, Queue, API |
| Phase 3 | 9-12 | DevOps — Docker, CI/CD, Monitoring |
| Phase 4 | 13-16 | Advanced — Search, Microservices, Security |
| Phase 5 | 17-18 | AI Engineering |
