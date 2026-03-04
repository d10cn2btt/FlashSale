# Week 18 — Agentic Workflow & AI as Teammate

> **Phase:** 5 — AI Engineering
> **Summary:** Tuần cuối. Kết hợp tất cả — specs tốt + AI mạnh = force multiplier. Learn cách delegate tasks cho AI agent, review output hiệu quả, và build personal AI workflow. Mục tiêu: mày build ít nhất 2x nhanh hơn so với tuần 1, với chất lượng cao hơn.

---

## 🎯 Goal cuối tuần (Milestone M7)
- [ ] Personal AI workflow documented
- [ ] Implement 1 full feature chỉ với AI (tự review, không tự code)
- [ ] Biết khi nào trust AI vs khi nào verify
- [ ] "AI review" skill: spot bad AI code nhanh

---

## Day 1 (Thứ 2) — AI Workflow Design

### Buổi sáng: 4 Levels of AI Usage

**Level 1: Autocomplete**
```
AI: suggest next line
You: accept/reject
→ Speed: 1.2x
```

**Level 2: Task completion**
```
You: "Write a function to do X"
AI: generates function
You: review, integrate
→ Speed: 1.5-2x
```

**Level 3: Feature delegation**
```
You: "Here's the spec, implement it"
AI: generates multiple files
You: review, test, adjust
→ Speed: 2-4x
```

**Level 4: Agentic**
```
You: "Here's the spec + tests, implement and make tests pass"
AI: implement → run tests → fix → repeat
You: review final result
→ Speed: 3-5x (nếu spec tốt)
```

### Buổi chiều: Your Personal Workflow

Design workflow của mày:

```
1. DEFINE: Viết spec (always)

2. PLAN: Hỏi AI: "Review spec này, có gì missing không?"
          → Nhận feedback → update spec

3. DELEGATE: "Implement theo spec. Start with data model."
             → Step-by-step, không giao toàn bộ 1 lần

4. REVIEW: Đọc từng file AI tạo ra
           → Hiểu logic
           → Check security
           → Check edge cases

5. TEST: Chạy tests
         → Nếu fail: "Tests fail, debug và fix"
         → Nếu pass: manually test edge cases

6. ITERATE: Feedback loop ngắn hơn là tốt hơn
```

---

## Day 2 (Thứ 3) — Prompting for Code Quality

### Buổi sáng: Prompts tốt vs Prompts tệ

**Prompt tệ:**
```
"Implement wishlist feature for my app"
→ AI không biết: tech stack, conventions, existing code
→ Kết quả: generic code không fit project
```

**Prompt tốt:**
```
"Implement the Wishlist feature according to this spec: [spec.md]

Context:
- NestJS backend, Prisma ORM, PostgreSQL
- Follow existing patterns in CourseModule (see course.service.ts)
- Use existing CacheService for list caching (TTL: 5 min)
- Error format: { error: { code: string, message: string } }
- Use class-validator for DTOs like existing DTOs

Start with: WishlistModule, WishlistService, WishlistController
Do NOT implement: the frontend (out of scope for this task)"
```

### Buổi chiều: Iterative Prompting

- [ ] Practice: implement 1 feature với step-by-step prompts
- [ ] **Prompt 1:** "Review my spec, ask clarifying questions"
- [ ] **Prompt 2:** "Based on answers, generate data model + migration"
- [ ] **Prompt 3:** "Generate service layer with unit tests"
- [ ] **Prompt 4:** "Generate controller + DTOs"
- [ ] **Prompt 5:** "Review the full implementation for security issues"

---

## Day 3 (Thứ 4) — Spotting Bad AI Code

### Buổi sáng: Red Flags trong AI Code

**Security issues:**
```typescript
// AI might generate this (WRONG):
const user = await prisma.user.findFirst({
  where: { email }
})
if (user.password === password) { ... }  // Không hash!
```

**Performance issues:**
```typescript
// AI might generate N+1 without thinking:
const orders = await prisma.order.findMany()
for (const order of orders) {
  order.user = await prisma.user.findUnique(...)  // N+1!
}
```

**Logic issues:**
```typescript
// AI might miss edge case:
async cancelOrder(id: string) {
  await prisma.order.update({
    where: { id },
    data: { status: 'cancelled' }
  })
  // BUG: Không check nếu order đã được fulfilled!
  // BUG: Không return inventory!
  // BUG: Không check ownership!
}
```

### Buổi chiều: Code Review Checklist for AI Code

```markdown
## AI Code Review Checklist

Security:
- [ ] Input validation present?
- [ ] Authorization checks (ownership, roles)?
- [ ] No raw SQL injection vectors?
- [ ] Sensitive data not logged?

Performance:
- [ ] N+1 queries?
- [ ] Missing indexes hinted?
- [ ] Large data fetched without pagination?
- [ ] Unnecessary DB calls in loops?

Logic:
- [ ] Edge cases covered (null, empty, zero)?
- [ ] Error handling complete?
- [ ] Transactions where needed?
- [ ] Business rules match spec?

Code Quality:
- [ ] Consistent with existing codebase style?
- [ ] No unused imports/variables?
- [ ] Tests included and meaningful?
```

---

## Day 4 (Thứ 5) — Agentic Feature Implementation

### Full Agentic Exercise

**Task:** Implement "Product Reviews & Ratings" feature hoàn chỉnh.

- [ ] **Step 1:** Viết spec.md (30 phút)
- [ ] **Step 2:** Feed spec vào AI với prompt tốt → generate full implementation
- [ ] **Step 3:** Review theo checklist
- [ ] **Step 4:** Run tests (AI cũng viết tests)
- [ ] **Step 5:** Fix issues found
- [ ] **Step 6:** Integrate và test manually

**Measure:**
- Thời gian tổng cộng
- Số lần AI sai/cần fix
- Chất lượng code cuối

---

## Day 5 (Thứ 6) — AI for Non-Coding Tasks

### AI giúp được nhiều hơn chỉ code:

**Architecture review:**
```
"Mày là experienced backend architect. 
Review architecture của FlashDeal (context: ...).
Tìm potential bottlenecks và improvements khi scale lên 1M users"
```

**Code review:**
```
"Review OrderService.createOrder() này.
Focus vào: security, performance, edge cases.
Be critical."
```

**Debugging:**
```
"Lỗi này xảy ra khi load test với 1000 concurrent users:
[error log]
[relevant code]
Phân tích root cause và suggest fix."
```

**Learning:**
```
"Tao vừa dùng Redis distributed lock để fix race condition.
Giải thích: tại sao cần Lua script khi release lock?
Có approach nào khác không? Trade-offs?"
```

---

## Day 6 (Thứ 7) — Building Your AI Toolkit

### Personal AI System

- [ ] **System prompt / Custom instructions** cho coding:
  ```
  - Tao làm NestJS + NextJS + Prisma
  - PostgreSQL + Redis
  - Follow REST best practices
  - Luôn include error handling
  - Luôn include input validation
  - Suggest tests khi implement logic
  - Point out security issues nếu thấy
  ```

- [ ] **Snippet library:** Những prompts hiệu quả hay dùng
- [ ] **Spec templates:** Tùy chỉnh cho FlashDeal conventions
- [ ] **AI dos and don'ts:**
  - DO: delegate boilerplate, ask for review, learn concepts
  - DON'T: blindly accept auth code, skip security review, trust AI for business logic mà không kiểm tra

---

## Day 7 (Chủ Nhật) — 18-Week Retrospective

### Chúc mừng! 18 tuần đã qua.

### Hãy nhìn lại:

**Week 1 bạn đã biết:**
- Laravel, PHP
- Viết CRUD app

**Tuần này bạn biết:**

| Skill | Before | After |
|---|---|---|
| Backend | Laravel only | NestJS + TypeScript |
| Database | Basic SQL | Indexing, Query opt, Transactions |
| Caching | Không có | Redis patterns, Stampede prevention |
| Queue | Không có | BullMQ, Event-driven |
| DevOps | Không có | Docker, CI/CD, Cloud deploy |
| Security | Cơ bản | OWASP Top 10, security headers |
| Monitoring | Không có | Prometheus, Grafana, Loki |
| Search | Không có | Elasticsearch |
| AI | Copy-paste | Spec-driven, agentic workflow |
| System Design | Không có | Scale thinking, trade-offs |

### Bước tiếp theo:

```
Tiếp tục build:
  → Apply những gì học vào real projects
  → Contribute to open source
  → Build side projects với scale mindset

Học thêm (nếu muốn):
  → Kubernetes (k8s) cho container orchestration
  → Apache Kafka cho event streaming
  → gRPC cho high-performance APIs
  → DDD (Domain-Driven Design)

Cộng đồng:
  → Review code của người khác
  → Viết blog về những gì đã học
  → Share FlashDeal project
```

---

## 📚 Tài liệu tham khảo
- [Claude — Prompting Guide](https://docs.anthropic.com/claude/docs/introduction-to-prompt-design)
- [GitHub Copilot Best Practices](https://docs.github.com/en/copilot/using-github-copilot)
- [AI-Assisted Development](https://martinfowler.com/articles/exploring-gen-ai.html)

---

*← [Week 17](./week-17.md) | [README →](./README.md)*

---

> **"The best time to plant a tree was 20 years ago. The second best time is now."**
>
> Mày đã plant the tree. Bây giờ chăm sóc nó.
