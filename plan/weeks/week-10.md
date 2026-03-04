# Week 10 — CI/CD với GitHub Actions

> **Phase:** 3 — DevOps
> **Summary:** Automate everything. Tuần này build complete CI/CD pipeline: từ code push đến tự động test, build Docker image, push registry, và deploy. Mục tiêu: mỗi commit lên `main` là 1 deployment hoàn toàn tự động, với safety gates (tests phải pass trước khi deploy).

---

## 🎯 Goal cuối tuần
- [ ] Push lên `main` → tự động deploy lên production
- [ ] Test failures block deployment
- [ ] Environment-based deployments (staging vs production)
- [ ] Rollback strategy hoạt động

---

## Day 1 (Thứ 2) — GitHub Actions Basics

### Buổi sáng: Core Concepts

```yaml
# .github/workflows/ci.yml

name: CI/CD Pipeline

on:                          # Trigger
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:                      # Job 1
    runs-on: ubuntu-latest   # Runner
    steps:
      - uses: actions/checkout@v4     # Checkout code
      - uses: actions/setup-node@v4   # Setup Node
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci           # Install deps
      - run: npm test         # Run tests
```

**Key concepts:**
- `on`: triggers (push, pull_request, schedule, workflow_dispatch)
- `jobs`: parallel by default
- `needs`: declare dependency → sequential
- `steps`: sequential within a job
- `uses`: reuse actions from marketplace
- `run`: shell command

### Buổi chiều: First Pipeline

- [ ] Viết pipeline chạy:
  1. Lint check (ESLint)
  2. Unit tests
  3. Integration tests (với test DB)
- [ ] Test: push code với eslint error → pipeline fail
- [ ] Fix error → pipeline pass

---

## Day 2 (Thứ 3) — Testing in CI

### Buổi sáng: Services trong GitHub Actions

```yaml
jobs:
  integration-test:
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: testpassword
          POSTGRES_DB: flashdeal_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
```

**Run migrations trong CI:**
```yaml
- name: Run migrations
  run: npx prisma migrate deploy
  env:
    DATABASE_URL: postgresql://postgres:testpassword@localhost:5432/flashdeal_test
```

### Buổi chiều: Test Coverage Report

- [ ] Generate coverage: `npm test -- --coverage`
- [ ] Upload to Codecov:
  ```yaml
  - uses: codecov/codecov-action@v4
    with:
      token: ${{ secrets.CODECOV_TOKEN }}
  ```
- [ ] Block merge nếu coverage < 70%

---

## Day 3 (Thứ 4) — Docker Build trong CI

### Buổi sáng: Build và Push Image

```yaml
jobs:
  build:
    needs: test
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: |
            myuser/flashdeal-backend:latest
            myuser/flashdeal-backend:${{ github.sha }}
          cache-from: type=gha    # GitHub Actions cache
          cache-to: type=gha,mode=max
```

### Buổi chiều: Tagging Strategy

```
:latest           ← main branch
:develop          ← develop branch
:v1.2.3           ← tagged release
:abc1234          ← commit SHA (immutable)
```

- [ ] Implement tagging dựa trên branch và tags
- [ ] Verify: push lên main → image `latest` + `<sha>` được tạo

---

## Day 4 (Thứ 5) — Deploy to Railway/Render

### Buổi sáng: Deploy Strategy

```
Strategy 1: Blue-Green Deployment
  Blue = current production
  Green = new version
  Switch traffic: Blue → Green
  Rollback: Green → Blue
  Pros: Zero downtime, easy rollback
  Cons: Double resources needed

Strategy 2: Rolling Deployment
  Replace instances one by one
  Pros: less resources
  Cons: 2 versions running simultaneously

Strategy 3: Recreate
  Stop old → start new
  Pros: Simple
  Cons: Downtime
```

### Buổi chiều: Implement Deploy Job

```yaml
jobs:
  deploy:
    needs: build
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment: production  # Requires manual approval in GitHub settings
    steps:
      - name: Deploy to Railway
        run: |
          curl -X POST ${{ secrets.RAILWAY_DEPLOY_WEBHOOK }}
```

- [ ] Setup Railway deploy webhook
- [ ] Add `environment: production` với protection rules:
  - Required reviewer trước khi deploy
  - Deploy window (chỉ deploy trong giờ hành chính)

---

## Day 5 (Thứ 6) — Staging Environment

### Buổi sáng: Branch Strategy

```
develop branch → deploy to staging automatically
main branch    → deploy to production (with approval)

Feature workflow:
  feature/xxx → PR → develop → staging → PR → main → production
```

### Buổi chiều: Staging Pipeline

- [ ] Separate `docker-compose.staging.yml`
- [ ] Staging dùng production data snapshot (anonymized)
- [ ] Smoke tests sau deploy:
  ```yaml
  - name: Run smoke tests
    run: |
      # Wait for app to be ready
      sleep 30
      # Test critical endpoints
      curl -f https://staging.flashdeal.com/health
      curl -f https://staging.flashdeal.com/api/v1/flash-sales/active
  ```

---

## Day 6 (Thứ 7) — Rollback & Notifications

### Buổi sáng: Rollback Strategy

```yaml
# Manual rollback: redeploy previous image
- name: Rollback
  if: failure()
  run: |
    # Deploy previous image tag
    echo "Deploying previous version: ${{ env.PREVIOUS_SHA }}"
    # Trigger deploy with previous SHA
```

- [ ] Automatic rollback nếu smoke tests fail
- [ ] Store previous deploy SHA trong GitHub Variables

### Buổi chiều: Slack Notifications

```yaml
- name: Notify Slack
  if: always()  # Run even on failure
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "Deploy ${{ job.status }}: ${{ github.repository }}",
        "blocks": [
          {
            "type": "section",
            "text": {
              "text": "Deploy to production: *${{ job.status }}*\nBranch: ${{ github.ref }}\nCommit: ${{ github.sha }}"
            }
          }
        ]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Day 7 (Chủ Nhật) — Pipeline Review

### Full pipeline review:

```
PR Created:
  → Lint
  → Unit Tests
  → Integration Tests
  → Code Coverage check
  → Security scan (npm audit)

Merge to develop:
  → All above
  → Build Docker image
  → Deploy to Staging
  → Smoke Tests

Tag/Release:
  → All above
  → Manual approval required
  → Deploy to Production
  → Smoke Tests
  → Notify Slack
  → Rollback if fail
```

- [ ] Verify toàn bộ pipeline chạy end-to-end
- [ ] Document pipeline trong README

---

## 📚 Tài liệu tham khảo
- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [GitHub Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments)

---

*← [Week 09](./week-09.md) | [Week 11 →](./week-11.md)*
