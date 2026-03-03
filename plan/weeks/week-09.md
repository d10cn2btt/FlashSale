# Week 09 — Docker Nâng Cao

> **Phase:** 3 — DevOps
> **Summary:** Phase 1 đã dùng Docker cơ bản. Tuần này đào sâu: multi-stage builds, image optimization, Docker networking, volumes, và Docker Compose production patterns. Kết thúc tuần với FlashDeal chạy hoàn toàn containerized — giống production.

---

## 🎯 Goal cuối tuần
- [ ] Docker image size < 100MB (từ ~500MB default)
- [ ] Multi-stage build cho backend + frontend
- [ ] Docker Compose với production-grade config
- [ ] Container security basics

---

## Day 1 (Thứ 2) — Docker Image Optimization

### Buổi sáng: Hiểu Docker layers

```dockerfile
# Mỗi instruction = 1 layer
# Layers được cache — thứ tự quan trọng

FROM node:20              # Layer 1 (base)
WORKDIR /app              # Layer 2
COPY package*.json ./     # Layer 3 (ít thay đổi → cache lâu)
RUN npm install           # Layer 4 (chỉ rebuild khi package*.json thay đổi)
COPY . .                  # Layer 5 (thay đổi thường xuyên)
RUN npm run build         # Layer 6
```

**Rule: thứ tự từ ít thay đổi → nhiều thay đổi**

### Buổi chiều: Multi-stage Build

```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci                      # npm ci nhanh và reproducible hơn npm install
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
# Chỉ copy những gì cần để chạy
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Non-root user cho security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000
CMD ["node", "dist/main.js"]
```

- [ ] Implement multi-stage build cho backend
- [ ] Đo image size: before vs after
- [ ] Multi-stage build cho frontend (build → nginx serve)

---

## Day 2 (Thứ 3) — Docker Networking

### Buổi sáng: Network types

```
bridge (default): containers trong cùng host, isolated network
host: container dùng network của host (Linux only)
none: no networking
overlay: multi-host networking (Swarm/Kubernetes)

Custom bridge network:
  - Containers tự resolve nhau qua tên
  - Isolated từ default bridge
```

**Docker Compose networking:**
```yaml
services:
  backend:
    networks:
      - app-network
      - db-network  # backend có thể reach db

  frontend:
    networks:
      - app-network

  postgres:
    networks:
      - db-network  # chỉ backend mới reach được

networks:
  app-network:
  db-network:
```

### Buổi chiều: Implement Network Segmentation

- [ ] Frontend không thể directly reach PostgreSQL
- [ ] Redis chỉ accessible từ backend
- [ ] Implement nginx reverse proxy:
  ```yaml
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    networks:
      - app-network
  ```

---

## Day 3 (Thứ 4) — Volumes & Data Persistence

### Buổi sáng: Volume types

```
Bind Mount: host dir → container dir
  - Development: code changes reflect immediately
  - Risk: container có quyền access host files

Volume (managed): Docker managed storage
  - Production: data persists beyond container lifecycle
  - Better isolation

tmpfs Mount: in-memory, không persist
  - Sensitive data: tokens, temp files
```

### Buổi chiều: Production Volume Config

```yaml
services:
  postgres:
    volumes:
      # Named volume - data persists
      - postgres_data:/var/lib/postgresql/data

  redis:
    command: redis-server --appendonly yes --requirepass "${REDIS_PASSWORD}"
    volumes:
      - redis_data:/data

  backend:
    volumes:
      # Dev only: live reload
      - ./src:/app/src  # KHÔNG dùng trong production

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
```

- [ ] Implement production docker-compose.yml
- [ ] Test: restart containers → data vẫn còn
- [ ] Backup strategy cho volumes

---

## Day 4 (Thứ 5) — Docker Compose Production Patterns

### Buổi sáng: Override files

```
docker-compose.yml          ← Base config (shared)
docker-compose.dev.yml      ← Development overrides
docker-compose.prod.yml     ← Production overrides

# Dùng:
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up
```

**docker-compose.dev.yml:**
```yaml
services:
  backend:
    volumes:
      - .:/app          # Live reload
    environment:
      - NODE_ENV=development
    command: npm run start:dev
```

**docker-compose.prod.yml:**
```yaml
services:
  backend:
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Buổi chiều: Environment Variables & Secrets

- [ ] `.env` file cho development (không commit!)
- [ ] `.env.example` cho documentation
- [ ] Docker secrets cho production:
  ```yaml
  secrets:
    db_password:
      file: ./secrets/db_password.txt
  ```
- [ ] `docker-compose.yml` không được có hardcoded passwords

---

## Day 5 (Thứ 6) — Container Security

### Security checklist:

- [ ] **Non-root user:** Dockerfile chạy với non-root
- [ ] **Read-only filesystem:**
  ```yaml
  security_opt:
    - no-new-privileges:true
  read_only: true
  tmpfs:
    - /tmp  # tmp có thể write
  ```
- [ ] **Limit capabilities:**
  ```yaml
  cap_drop:
    - ALL
  cap_add:
    - NET_BIND_SERVICE  # chỉ thêm lại cái cần
  ```
- [ ] **No latest tag:** luôn pin version (`node:20.11-alpine`)
- [ ] **Scan vulnerabilities:** `docker scout cves myimage`
- [ ] **Không commit `.env`:** `.dockerignore` phải exclude nó

### Buổi chiều: .dockerignore

```dockerignore
node_modules
.git
.env*
*.log
dist
coverage
.DS_Store
README.md
```

- [ ] Optimize build context size với .dockerignore
- [ ] `docker build` time before vs after

---

## Day 6 (Thứ 7) — Health Checks & Graceful Shutdown

### Buổi sáng: Health Checks

```typescript
// NestJS TerminusModule
@Get('health')
@HealthCheck()
check() {
  return this.health.check([
    () => this.db.pingCheck('database'),
    () => this.redis.checkHealth('redis'),
    () => this.mem.checkHeap('memory_heap', 150 * 1024 * 1024),
  ])
}
```

### Buổi chiều: Graceful Shutdown

```typescript
// main.ts
const app = await NestFactory.create(AppModule)

// Graceful shutdown
app.enableShutdownHooks()

// Handler trong service:
async onApplicationShutdown(signal: string) {
  // Finish processing current requests
  // Close DB connections
  // Drain queue workers
  console.log(`Shutting down gracefully (signal: ${signal})`)
}
```

- [ ] Implement graceful shutdown
- [ ] Test: `docker stop` → container waits for in-flight requests

---

## Day 7 (Chủ Nhật) — Recap & Next Phase Preview

### Docker knowledge checklist:
- [ ] Multi-stage builds
- [ ] Layer caching strategy
- [ ] Network segmentation
- [ ] Volume persistence
- [ ] Compose override files
- [ ] Container security
- [ ] Health checks
- [ ] Graceful shutdown

### Preview Week 10:
Chuẩn bị hiểu CI/CD: *"Chuyện gì xảy ra khi code bị push lên GitHub?"*

---

## 📚 Tài liệu tham khảo
- [Docker Best Practices](https://docs.docker.com/develop/develop-images/instructions/)
- [Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [NestJS Terminus Health Check](https://docs.nestjs.com/recipes/terminus)

---

*← [Week 08](./week-08.md) | [Week 10 →](./week-10.md)*
