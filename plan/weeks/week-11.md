# Week 11 — Cloud Basics (AWS/GCP)

> **Phase:** 3 — DevOps
> **Summary:** Không cần trở thành Cloud Engineer. Mục tiêu: hiểu đủ để deploy, scale, và manage app trên cloud. Tập trung vào những services thực tế nhất: EC2/Cloud Run, RDS, ElastiCache, S3, và VPC cơ bản. Hands-on hoàn toàn — setup FlashDeal trên cloud thật.

---

## 🎯 Goal cuối tuần
- [ ] FlashDeal deployed trên AWS hoặc GCP (không dùng Railway/Render)
- [ ] RDS PostgreSQL thay vì containerized DB
- [ ] S3/GCS cho file uploads
- [ ] ElastiCache/Memorystore cho Redis
- [ ] Basic VPC security hiểu được

---

## Day 1 (Thứ 2) — Cloud Provider Overview

### Buổi sáng: AWS vs GCP vs Azure cho Dev

| Service | AWS | GCP | Mục đích |
|---|---|---|---|
| Compute | EC2 / ECS | Compute Engine / Cloud Run | Chạy app |
| Database | RDS | Cloud SQL | Managed PostgreSQL |
| Cache | ElastiCache | Memorystore | Managed Redis |
| Object Store | S3 | GCS | Files, images |
| CDN | CloudFront | Cloud CDN | Static assets |
| Secrets | Secrets Manager | Secret Manager | API keys, passwords |
| Container | ECS/EKS | GKE/Cloud Run | Run containers |

**Recommendation:** Nếu mới học → **GCP** có free tier tốt hơn và Cloud Run là serverless containers rất tiện.

### Buổi chiều: Cloud Account Setup

**Option A: GCP (Recommended)**
- [ ] Tạo account GCP ($300 free credit)
- [ ] Install `gcloud` CLI
- [ ] Setup project: `gcloud projects create flashdeal`

**Option B: AWS**
- [ ] Tạo account AWS
- [ ] Install AWS CLI
- [ ] Setup credentials

---

## Day 2 (Thứ 3) — Managed Database (RDS/Cloud SQL)

### Buổi sáng: Tại sao managed DB?

```
Self-managed (trong Docker):
  - Mày tự backup
  - Mày tự patch security
  - Mày tự handle failover
  - Single point of failure

Managed DB (RDS/Cloud SQL):
  + Automated backups
  + Automated patching
  + Multi-AZ failover
  + Read replicas dễ setup
  + Monitoring built-in
  - Đắt hơn
  - Ít control hơn
```

### Buổi chiều: Setup Cloud SQL / RDS

**GCP Cloud SQL:**
```bash
# Create PostgreSQL instance
gcloud sql instances create flashdeal-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=asia-southeast1

# Create database
gcloud sql databases create flashdeal --instance=flashdeal-db

# Create user
gcloud sql users create flashdeal_user \
  --instance=flashdeal-db \
  --password=STRONG_PASSWORD
```

- [ ] Connect từ local bằng Cloud SQL Proxy
- [ ] Run Prisma migrations
- [ ] Test connection

---

## Day 3 (Thứ 4) — Object Storage (S3/GCS)

### Buổi sáng: Tại sao cần Object Storage?

```
Vấn đề khi lưu file trong container:
  - Data mất khi container restart
  - Multiple instances → files split
  - Không scale được

Object Storage:
  - Infinite scale
  - High durability (99.999999999%)
  - CDN integration
  - Cheap ($0.02/GB)
```

### Buổi chiều: Implement File Upload

- [ ] Setup GCS bucket hoặc S3 bucket
- [ ] NestJS: upload product images:
  ```typescript
  @Post('products/:id/image')
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const url = await this.storageService.upload(file)
    return { url }
  }
  ```

- [ ] `StorageService` với `@google-cloud/storage`:
  - Upload file → return public URL
  - Delete file khi product deleted

- [ ] NextJS: image upload UI với preview

---

## Day 4 (Thứ 5) — Deploy App lên Cloud

### Buổi sáng: Cloud Run (GCP) — Serverless Containers

```bash
# Build và push image
docker build -t gcr.io/PROJECT/flashdeal-backend .
docker push gcr.io/PROJECT/flashdeal-backend

# Deploy to Cloud Run
gcloud run deploy flashdeal-backend \
  --image gcr.io/PROJECT/flashdeal-backend \
  --platform managed \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=...
```

**Cloud Run tự động:**
- Scales từ 0 đến N instances
- Load balancing
- HTTPS certificate
- Pay per request

### Buổi chiều: Environment Variables với Secret Manager

```bash
# Store secret
gcloud secrets create DATABASE_URL \
  --replication-policy automatic

echo -n "postgresql://..." | \
  gcloud secrets versions add DATABASE_URL --data-file=-

# Reference trong Cloud Run
gcloud run services update flashdeal-backend \
  --set-secrets DATABASE_URL=DATABASE_URL:latest
```

- [ ] Move tất cả secrets sang Secret Manager
- [ ] CI/CD sử dụng service account để access secrets

---

## Day 5 (Thứ 6) — VPC & Network Security

### Buổi sáng: VPC Concepts

```
VPC (Virtual Private Cloud):
  - Private network trong cloud
  - Subnets: public (internet access) vs private (no internet)
  - Security Groups / Firewall rules: who can talk to who

Ideal setup:
  Internet → Load Balancer (public subnet)
             → App Servers (private subnet)
             → DB, Redis (private subnet, no internet)
```

### Buổi chiều: Basic Security Setup

- [ ] Cloud SQL chỉ accessible từ App (không public)
- [ ] Redis chỉ accessible từ App
- [ ] App accessible qua HTTPS only
- [ ] Enable Cloud Armor / WAF basic rules:
  - Block SQL injection
  - Rate limiting at network level
  - Block known malicious IPs

---

## Day 6 (Thứ 7) — Cost Optimization

### Understand Cloud Billing:

```
Pricing mày cần hiểu:
  Compute: per vCPU/hour + per GB RAM/hour
  Storage: per GB/month
  Network: per GB egress (outbound data tốn tiền, inbound free)
  DB: per hour + per GB storage
  Request: Cloud Run charges per million requests
```

- [ ] Set up **budget alerts**: alert khi cost > $X
- [ ] Review FlashDeal architecture:
  - Có thể dùng Cloud Run thay vì VM không?
  - DB tier có quá lớn không?
  - Cần reserved instances không?

---

## Day 7 (Chủ Nhật) — Architecture on Cloud

### Vẽ production architecture của FlashDeal trên cloud:

```
Internet
  ↓
Cloud Load Balancer (HTTPS termination)
  ↓
Cloud Run: Backend (auto-scale 0-10 instances)
  ↙        ↘
Cloud SQL    Memorystore Redis
PostgreSQL   (private network)
(private)
  ↓
Cloud Storage (GCS)
  ↓
CDN (images)
```

**Tự trả lời:**
1. Tại sao DB nên ở private subnet?
2. Cloud Run vs EC2/VM — trade-offs?
3. Managed Redis vs self-hosted Redis?
4. How to zero-downtime deploy?

---

## 📚 Tài liệu tham khảo
- [GCP Free Tier](https://cloud.google.com/free)
- [Cloud Run Quickstart](https://cloud.google.com/run/docs/quickstarts)
- [Cloud SQL Connect](https://cloud.google.com/sql/docs/postgres/connect-run)
- [GCS NestJS](https://www.npmjs.com/package/@google-cloud/storage)

---

*← [Week 10](./week-10.md) | [Week 12 →](./week-12.md)*
