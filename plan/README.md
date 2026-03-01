# 🗺️ Learning Roadmap — From Laravel Dev to Scalable Systems Engineer

## Tổng quan

Đây là kế hoạch học tập **18 tuần** dành cho Laravel developer muốn:
- Chuyển sang **NestJS + NextJS**
- Hiểu sâu **System Design** & tư duy scale
- Nắm **DevOps** đủ dùng trong production
- Làm chủ **AI-assisted development**

**Project thực hành xuyên suốt:** FlashDeal — Mini Flash Sale Platform
> Được chọn vì buộc mày phải đối mặt với đúng những vấn đề scaling thật: race condition, caching, queue, concurrent users.

---

## 🏗️ 5 Phases

| Phase | Tuần | Layer | Mô tả |
|---|---|---|---|
| **Phase 1** | Week 1-4 | Layer 1 | NestJS + NextJS — Build FlashDeal từ đầu |
| **Phase 2** | Week 5-8 | Layer 2 | System Design — Database, Cache, Queue nâng cao |
| **Phase 3** | Week 9-12 | Layer 3 | DevOps — Docker, CI/CD, Cloud, Monitoring |
| **Phase 4** | Week 13-16 | Layer 2++ | Advanced Systems — Search, Microservices, Security |
| **Phase 5** | Week 17-18 | Layer 4 | AI Engineering — Specs-driven, Agentic workflow |

---

## 📅 Weekly Index

### Phase 1 — NestJS + NextJS Foundation
- [Week 01 — Architecture & Auth](./week-01.md)
- [Week 02 — Core Features, Caching, Race Condition](./week-02.md)
- [Week 03 — Queue, Async & Frontend](./week-03.md)
- [Week 04 — Polish, Testing & NestJS Deep Dive](./week-04.md)

### Phase 2 — System Design
- [Week 05 — Database Deep Dive](./week-05.md)
- [Week 06 — Caching Patterns Nâng Cao](./week-06.md)
- [Week 07 — Queue & Event-Driven Architecture](./week-07.md)
- [Week 08 — API Design & Scalability Patterns](./week-08.md)

### Phase 3 — DevOps
- [Week 09 — Docker Nâng Cao](./week-09.md)
- [Week 10 — CI/CD với GitHub Actions](./week-10.md)
- [Week 11 — Cloud Basics (AWS/GCP)](./week-11.md)
- [Week 12 — Monitoring & Observability](./week-12.md)

### Phase 4 — Advanced Systems
- [Week 13 — Search với Elasticsearch](./week-13.md)
- [Week 14 — Microservices Introduction](./week-14.md)
- [Week 15 — Security Deep Dive](./week-15.md)
- [Week 16 — Performance Optimization](./week-16.md)

### Phase 5 — AI Engineering
- [Week 17 — Specs-Driven Development](./week-17.md)
- [Week 18 — Agentic Workflow & AI as Teammate](./week-18.md)

---

## 🎯 Milestones

| Milestone | Sau tuần | Kết quả cụ thể |
|---|---|---|
| **M1: App chạy được** | Week 1 | FlashDeal: auth + docker-compose up |
| **M2: Core features done** | Week 2 | Order flow + race condition fixed |
| **M3: Production-ready v1** | Week 4 | Deployed, có test, CI/CD |
| **M4: System thinking** | Week 8 | Có thể thiết kế hệ thống mới từ 0 |
| **M5: Full DevOps** | Week 12 | Monitor được app, deploy tự động |
| **M6: Senior-level** | Week 16 | Build & scale feature phức tạp |
| **M7: AI Engineer** | Week 18 | Dùng AI như force multiplier, không phải crutch |

---

## 🧠 Nguyên tắc học

1. **Làm thật trước, đọc lý thuyết sau** — Code cái gì đó, gặp vấn đề, rồi mới đọc
2. **Tự hỏi "Nếu scale 10x thì sao?"** — Với mọi feature mày build
3. **Dùng AI như mentor, không phải ghost-writer** — Tự viết trước, AI review sau
4. **Mỗi tuần có 1 deliverable cụ thể** — Không phải "tao đọc xong chương X"
5. **Post-mortem cuối mỗi phase** — Viết lại những gì học được

---

## 📦 Tech Stack FlashDeal

```
Backend:    NestJS + Prisma + PostgreSQL
Cache:      Redis
Queue:      BullMQ (chạy trên Redis)
Frontend:   NextJS + TailwindCSS
Auth:       JWT + Refresh Token
DevOps:     Docker + GitHub Actions + Railway/Render
Monitoring: Prometheus + Grafana (Phase 3)
Search:     Elasticsearch (Phase 4)
```

---

*Bắt đầu: [Week 01 →](./week-01.md)*
