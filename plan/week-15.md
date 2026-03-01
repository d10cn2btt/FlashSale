# Week 15 — Security Deep Dive

> **Phase:** 4 — Advanced Systems
> **Summary:** Security không phải optional — breach 1 lần có thể phá tan cả business. Tuần này: OWASP Top 10 cho Node.js apps, injection prevention, CSRF/XSS protection, security headers, dependency scanning, và penetration testing basics. Audit toàn bộ FlashDeal.

---

## 🎯 Goal cuối tuần
- [ ] FlashDeal pass OWASP Top 10 checklist
- [ ] Automated security scanning trong CI/CD
- [ ] Penetration test cơ bản tự làm
- [ ] Security headers configured

---

## Day 1 (Thứ 2) — OWASP Top 10

### Buổi sáng: Top 10 Vulnerabilities

**A01: Broken Access Control**
```typescript
// WRONG: User có thể xem order của người khác
app.get('/orders/:id', async (req) => {
  return prisma.order.findUnique({ where: { id: req.params.id } })
})

// RIGHT: Verify ownership
app.get('/orders/:id', authGuard, async (req) => {
  const order = await prisma.order.findFirst({
    where: {
      id: req.params.id,
      userId: req.user.id,  // Only show to owner
    }
  })
  if (!order) throw new NotFoundException()
  return order
})
```

**A02: Cryptographic Failures**
- Passwords không hash → bcrypt/argon2
- Sensitive data không encrypted at rest
- HTTP thay vì HTTPS

**A03: Injection**
```typescript
// SQL Injection (Prisma prevents this by default with parameterized queries)
// Nhưng nếu dùng raw SQL:

// WRONG:
prisma.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`)

// RIGHT:
prisma.$queryRaw`SELECT * FROM users WHERE email = ${email}`
```

**A04: Insecure Design** — Security phải được thiết kế từ đầu, không thêm sau

**A05: Security Misconfiguration**
- Default credentials
- Debug mode in production
- Error messages tiết lộ stack trace

**A07: Identification & Authentication Failures**
- Brute force attack không bị block
- Weak JWT secrets
- No session timeout

### Buổi chiều: Audit FlashDeal

- [ ] Check từng item trong OWASP Top 10 list
- [ ] Document findings
- [ ] Prioritize và create fix list

---

## Day 2 (Thứ 3) — Injection & Input Validation

### Buổi sáng: Input Validation Defense

```typescript
// class-validator với NestJS
export class CreateProductDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  @Trim()
  name: string

  @IsNumber()
  @Min(0)
  @Max(1000000)
  price: number

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Sanitize()          // Remove HTML tags
  description?: string
}
```

**NoSQL Injection (MongoDB — không dùng trong FlashDeal nhưng cần biết):**
```javascript
// WRONG:
db.users.find({ username: req.body.username })
// Attack: { username: { $gt: '' } } → match ALL users

// RIGHT: Validate types trước
if (typeof req.body.username !== 'string') throw Error()
```

### Buổi chiều: XSS Prevention

```typescript
// Helmet cho security headers
import helmet from 'helmet'

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://storage.googleapis.com'],
    },
  },
}))
```

**Frontend:**
- Không dùng `dangerouslySetInnerHTML` với user input
- Sanitize với `DOMPurify` nếu cần render HTML
- `httpOnly` cookie cho sensitive tokens

---

## Day 3 (Thứ 4) — Rate Limiting & Brute Force

### Buổi sáng: Tấn công và phòng thủ

**Brute Force Login:**
```
Attack: thử 1000 passwords cho email@example.com
Protection:
  - Rate limit: 5 attempts per 15 minutes per IP
  - Lockout: sau 10 fails → lock account 30 phút
  - Captcha sau 3 fails
  - Alert user khi nhiều failed attempts
```

```typescript
// NestJS Throttler
@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 900000,    // 15 minutes
      limit: 5,       // 5 requests
    }]),
  ],
})

// Apply chỉ cho auth endpoints
@Throttle({ default: { ttl: 900000, limit: 5 } })
@Post('login')
async login() {}
```

### Buổi chiều: DDoS Basic Protection

- [ ] Rate limiting per IP tại nginx level
- [ ] Request size limit:
  ```typescript
  app.use(express.json({ limit: '1mb' }))
  ```
- [ ] Timeout cho requests:
  ```typescript
  server.setTimeout(30000)  // 30 second timeout
  ```
- [ ] Cloud Armor / Cloudflare DDoS protection

---

## Day 4 (Thứ 5) — Security Headers & CORS

### Buổi sáng: Security Headers

```typescript
app.use(helmet())
// Sets:
// X-XSS-Protection: 1; mode=block
// X-Frame-Options: SAMEORIGIN (chống clickjacking)
// X-Content-Type-Options: nosniff
// Strict-Transport-Security: max-age=31536000 (HTTPS only)
// Content-Security-Policy: ...
```

### Buổi chiều: CORS đúng cách

```typescript
// WRONG: Allow all origins in production
app.enableCors({ origin: '*' })

// RIGHT:
app.enableCors({
  origin: (origin, callback) => {
    const allowedOrigins = [
      'https://flashdeal.com',
      'https://www.flashdeal.com',
      process.env.NODE_ENV !== 'production' && 'http://localhost:3000',
    ].filter(Boolean)

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
})
```

---

## Day 5 (Thứ 6) — Dependency Security

### Buổi sáng: Supply Chain Attacks

```bash
# Kiểm tra vulnerabilities trong dependencies
npm audit

# Fix automatically
npm audit fix

# Check với Snyk (more thorough)
npx snyk test
```

**CI/CD integration:**
```yaml
- name: Security audit
  run: npm audit --audit-level=high
  # Fail CI nếu có HIGH/CRITICAL vulnerabilities
```

### Buổi chiều: Secret Management

```bash
# Scan code cho leaked secrets
npx @secretlint/secretlint "**/*"

# Pre-commit hook:
# .git/hooks/pre-commit
npx @secretlint/secretlint "**/*" || exit 1
```

- [ ] Setup git-secrets hoặc gitleaks để prevent secret commits
- [ ] Rotate tất cả secrets đã expose (nếu có)
- [ ] Document: secrets không bao giờ trong code

---

## Day 6 (Thứ 7) — Penetration Testing Basics

### Self-pen-test FlashDeal:

- [ ] **IDOR Test:**
  - Login as User A → Get order of User B → Should fail
  - `GET /orders/{user_B_order_id}` with User A token

- [ ] **Auth bypass:**
  - Modified JWT → Should reject
  - Expired token → Should reject
  - Blacklisted token → Should reject

- [ ] **SQL Injection test:**
  - Input: `'; DROP TABLE users; --`
  - Should return validation error

- [ ] **Rate limit test:**
  - 6 login attempts → Should block

- [ ] **Large payload:**
  - Send 10MB request body → Should reject

---

## Day 7 (Chủ Nhật) — Security Checklist

### FlashDeal Security Audit:

- [ ] All inputs validated with strong typing
- [ ] SQL injection impossible (parameterized queries)
- [ ] XSS prevented (helmet, CSP, sanitization)
- [ ] Auth required for all protected endpoints
- [ ] IDOR checks on all resource access
- [ ] Rate limiting on auth endpoints
- [ ] Secure session management
- [ ] HTTPS only in production
- [ ] Secrets in environment variables (not in code)
- [ ] Dependencies scanned for vulnerabilities
- [ ] Security headers configured
- [ ] CORS properly configured

---

## 📚 Tài liệu tham khảo
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NestJS Security](https://docs.nestjs.com/security/helmet)
- [OWASP Node.js Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)

---

*← [Week 14](./week-14.md) | [Week 16 →](./week-16.md)*
