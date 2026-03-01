# Week 12 — Monitoring & Observability

> **Phase:** 3 — DevOps
> **Summary:** "You can't manage what you can't measure." Tuần này setup complete observability stack: structured logging với Pino, metrics với Prometheus, dashboards với Grafana, và distributed tracing concept. Kết thúc Phase 3 với ability to debug production issues nhanh chóng.

---

## 🎯 Goal cuối tuần (Milestone M5)
- [ ] Structured logging với correlation IDs
- [ ] Prometheus metrics cho tất cả critical operations
- [ ] Grafana dashboard cho FlashDeal
- [ ] Alert khi error rate > 1% hoặc p99 latency > 1s
- [ ] Hiểu distributed tracing concept

---

## Day 1 (Thứ 2) — Structured Logging

### Buổi sáng: Từ console.log đến structured logs

**Unstructured (BAD):**
```
[2026-03-01 10:00:00] User 123 created order 456 for flash sale 789
```

**Structured (GOOD):**
```json
{
  "level": "info",
  "timestamp": "2026-03-01T10:00:00Z",
  "correlationId": "req-abc123",
  "userId": 123,
  "orderId": 456,
  "flashSaleId": 789,
  "action": "order.created",
  "duration": 45,
  "service": "order-service"
}
```

**Tại sao?**
- Dễ query với log aggregation tools (Loki, CloudWatch)
- Filter theo `userId=123` → tất cả actions của user đó
- Trace request flow qua `correlationId`

### Buổi chiều: Setup Pino Logger

```typescript
// Pino: fastest Node.js logger
import pino from 'pino'

// NestJS với nestjs-pino
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty' }  // dev: human readable
          : undefined                   // prod: JSON
      }
    })
  ]
})
```

- [ ] Setup `nestjs-pino`
- [ ] Correlation ID middleware:
  ```typescript
  // Generate ID per request, attach to all logs
  app.use((req, res, next) => {
    req.id = crypto.randomUUID()
    next()
  })
  ```
- [ ] Tất cả logs phải có: correlationId, userId (nếu auth), action

---

## Day 2 (Thứ 3) — Metrics với Prometheus

### Buổi sáng: Metrics Types

```
Counter: chỉ tăng (requests count, errors count)
Gauge: tăng giảm (active connections, memory usage)
Histogram: distribution (request latency percentiles)
Summary: similar to histogram
```

**Key metrics cho production app:**

| Metric | Type | Alert khi |
|---|---|---|
| `http_requests_total` | Counter | Error rate > 1% |
| `http_request_duration_seconds` | Histogram | p99 > 1 second |
| `db_query_duration_seconds` | Histogram | p95 > 100ms |
| `cache_hits_total` | Counter | Hit rate < 80% |
| `queue_depth` | Gauge | > 1000 |
| `active_connections` | Gauge | > 80% of pool |

### Buổi chiều: Setup Prometheus

```typescript
// nestjs-prom hoặc @willsoto/nestjs-prometheus
import { PrometheusModule } from '@willsoto/nestjs-prometheus'
import { makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus'

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',  // Prometheus scrapes này
    })
  ],
  providers: [
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    }),
  ]
})
```

- [ ] Implement metrics cho:
  - HTTP requests (via interceptor)
  - DB queries (via Prisma middleware)
  - Cache hits/misses
  - Queue depth

---

## Day 3 (Thứ 4) — Grafana Dashboards

### Buổi sáng: Setup Prometheus + Grafana

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

**prometheus.yml:**
```yaml
scrape_configs:
  - job_name: 'flashdeal-backend'
    static_configs:
      - targets: ['backend:3000']
    metrics_path: '/metrics'
    scrape_interval: 15s
```

### Buổi chiều: Build Dashboard

- [ ] Grafana dashboard với panels:
  - Request rate (requests/sec)
  - Error rate (5xx percentage)
  - Latency percentiles (p50, p95, p99)
  - Cache hit rate
  - Active orders queue depth
  - DB connections
- [ ] Export dashboard JSON để commit vào repo

---

## Day 4 (Thứ 5) — Alerting

### Buổi sáng: Prometheus Alerting Rules

```yaml
# alerts.yml
groups:
  - name: flashdeal
    rules:
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status_code=~"5.."}[5m])
          / rate(http_requests_total[5m]) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Error rate > 1% for 5 minutes"
          description: "Current error rate: {{ $value | humanizePercentage }}"

      - alert: HighLatency
        expr: |
          histogram_quantile(0.99,
            rate(http_request_duration_seconds_bucket[5m])
          ) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "p99 latency > 1 second"
```

### Buổi chiều: Alertmanager

```yaml
# alertmanager.yml
receivers:
  - name: 'slack-notifications'
    slack_configs:
      - api_url: 'YOUR_SLACK_WEBHOOK'
        channel: '#alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
```

- [ ] Alert khi:
  - Error rate > 1%
  - p99 latency > 1 second
  - Queue depth > 1000
  - Memory > 80%
- [ ] Test: tạo 500 errors → alert fires trong Slack

---

## Day 5 (Thứ 6) — Log Aggregation với Loki

### Buổi sáng: Grafana Loki cho Logs

```
Prometheus = metrics
Loki = logs (Prometheus for logs)
Tempo = traces

Cả 3 đều tích hợp với Grafana → one dashboard for everything
```

```yaml
# docker-compose.monitoring.yml
services:
  loki:
    image: grafana/loki
    ports:
      - "3100:3100"

  promtail:       # Log collector agent
    image: grafana/promtail
    volumes:
      - /var/log:/var/log
```

- [ ] NestJS → Pino logs → Promtail → Loki → Grafana
- [ ] Query logs trong Grafana:
  ```
  {job="flashdeal"} |= "error"
  {job="flashdeal"} | json | userId = "123"
  ```

### Buổi chiều: Unified Dashboard

- [ ] Grafana: logs + metrics trong cùng dashboard
- [ ] Correlate: khi latency spike → drill down vào logs cùng timeframe
- [ ] Tạo "FlashDeal Ops" dashboard:
  - Overview panel (requests, errors, latency)
  - Log stream (real-time)
  - Queue metrics

---

## Day 6 (Thứ 7) — Distributed Tracing Concepts

### Không implement nhưng phải hiểu:

```
Distributed Tracing:
  1 request → spans qua nhiều services

Request:
  → [Span A: HTTP Handler 200ms]
      → [Span B: DB Query 50ms]
      → [Span C: Redis Cache 5ms]
      → [Span D: Queue Push 3ms]

Trace = tất cả spans của 1 request
→ Tracing tool (Jaeger, Zipkin, Tempo) visualize toàn bộ flow
→ Identify bottleneck ngay lập tức
```

**Tools:** OpenTelemetry (standard) → Jaeger / Grafana Tempo

- [ ] Đọc: OpenTelemetry cho Node.js
- [ ] Setup basic với `@opentelemetry/auto-instrumentations-node`
- [ ] Xem traces trong Grafana Tempo (local)

---

## Day 7 (Chủ Nhật) — Phase 3 Retrospective

### Phase 3 complete! Review:

**DevOps stack mày đã học:**
- Docker: multi-stage build, networking, security
- CI/CD: GitHub Actions end-to-end
- Cloud: managed services, VPC, secrets
- Monitoring: structured logging, metrics, dashboards, alerting

**"Golden Signals" của Production Monitoring:**
1. **Latency:** How long to serve requests?
2. **Traffic:** How much demand?
3. **Errors:** Rate of failing requests?
4. **Saturation:** How full is the system?

Mày đã setup đầy đủ 4 signals này cho FlashDeal.

**Chuẩn bị Phase 4:** *"Hệ thống của mày cần tìm kiếm full-text?"*

---

## 📚 Tài liệu tham khảo
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
- [nestjs-pino](https://github.com/iamolegga/nestjs-pino)
- [Grafana Dashboards](https://grafana.com/docs/grafana/latest/dashboards/)
- [Google SRE Book — Monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)

---

*← [Week 11](./week-11.md) | [Week 13 →](./week-13.md)*
