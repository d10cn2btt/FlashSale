# Week 17 — Specs-Driven Development

> **Phase:** 5 — AI Engineering
> **Summary:** Tuần này học cách viết specs để AI có thể implement đúng và đủ. Đây là multiplier skill: spec tốt = AI code tốt = ít review = ship nhanh hơn. Học cách cấu trúc PRD, technical spec, và task breakdown để AI (hoặc người khác) có thể pick up và implement mà không cần hỏi nhiều.

---

## 🎯 Goal cuối tuần
- [ ] Viết spec cho 1 feature hoàn chỉnh
- [ ] AI implement feature đó từ spec (ít nhất 80% đúng)
- [ ] Template spec cá nhân của mày
- [ ] Hiểu sự khác nhau giữa spec tốt và tệ

---

## Day 1 (Thứ 2) — Anatomy of a Good Spec

### Buổi sáng: Spec tệ vs Spec tốt

**Spec tệ:**
```
Add wishlist feature to FlashDeal
```

**Spec tốt:**
```markdown
# Feature: Product Wishlist

## Context
Users muốn save products để mua sau.
Currently không có cách nào track interest.

## User Stories
- As a logged-in user, I can add/remove product to wishlist
- As a user, I can view my wishlist
- As a user, I can move item from wishlist to cart
- As a guest, I can NOT access wishlist (login required)

## Acceptance Criteria
- [ ] POST /wishlist/items { productId } → 201 Created
- [ ] POST /wishlist/items (existing) → 409 Conflict
- [ ] DELETE /wishlist/items/:productId → 204 No Content
- [ ] GET /wishlist → list of products with pagination
- [ ] Max 50 items per user wishlist
- [ ] Wishlist persists across sessions
- [ ] Guest access → 401 Unauthorized

## Data Model
wishlists:
  id, user_id, created_at

wishlist_items:
  id, wishlist_id, product_id, added_at
  UNIQUE(wishlist_id, product_id)

## API Spec
[detailed endpoint specs]

## Error Cases
- Product not found → 404
- Wishlist full (50 items) → 422 with message
- Unauthenticated → 401

## Out of Scope
- Sharing wishlist with others
- Email reminder for wishlist items on sale
```

### Buổi chiều: Spec Components

| Section | Tại sao cần |
|---|---|
| Context | AI hiểu why → better decisions |
| User Stories | Behavior từ user perspective |
| Acceptance Criteria | Testable, unambiguous |
| Data Model | AI không phải guess schema |
| API Spec | Interface contract |
| Error Cases | AI không bỏ sót edge cases |
| Out of Scope | Ngăn AI "sáng tạo" ngoài scope |

---

## Day 2 (Thứ 3) — Writing Acceptance Criteria

### Buổi sáng: Given-When-Then Format

```gherkin
Feature: Flash Sale Ordering

Scenario: Successful order when stock available
  Given I am a logged-in user
  And there is a flash sale with 10 items remaining
  When I submit an order for 1 item
  Then the order is created with status "pending"
  And the inventory decreases by 1
  And I receive an order confirmation

Scenario: Order fails when out of stock
  Given I am a logged-in user
  And there is a flash sale with 0 items remaining
  When I submit an order
  Then I receive a 409 error with message "Out of stock"
  And no order is created

Scenario: Concurrent orders don't oversell
  Given there is a flash sale with 1 item remaining
  When 100 users submit orders simultaneously
  Then exactly 1 order succeeds
  And 99 orders receive 409 error
```

### Buổi chiều: Practice — Write ACs for FlashDeal Feature

- [ ] Chọn 1 feature chưa implement (ví dụ: Reviews/Ratings)
- [ ] Viết đầy đủ ACs theo Given-When-Then
- [ ] Review: có ambiguous case nào không?

---

## Day 3 (Thứ 4) — Technical Spec vs PRD

### Buổi sáng: Hai loại spec

**PRD (Product Requirements Document):**
- WHAT và WHY
- Business requirements
- User stories
- Success metrics
- Viết bởi: PM, nhưng dev cần đọc

**Technical Spec:**
- HOW
- Architecture decisions
- API design
- Data model
- Performance requirements
- Viết bởi: Dev

### Buổi chiều: Technical Spec Template

```markdown
# Technical Spec: [Feature Name]

## Overview
[1-2 sentences about what this is]

## Background / Motivation
[Context, current limitation, why now]

## Goals
- [Measurable goal 1]
- [Measurable goal 2]

## Non-Goals (Out of Scope)
- [Explicitly what we're NOT building]

## Architecture
[Diagram or description of how components interact]

## API Design
### Endpoint 1: POST /resource
Request:
  Headers: Authorization: Bearer {token}
  Body: { field1: string, field2: number }

Response 201:
  { "data": { "id": 1, "field1": "value" } }

Response 422:
  { "error": { "code": "VALIDATION_ERROR", "message": "..." } }

## Data Model
[Schema changes]

## Implementation Plan
- [ ] Task 1: [specific, 1-2 hour tasks]
- [ ] Task 2:
- [ ] Task 3:

## Performance Considerations
[Expected load, caching strategy, indexes needed]

## Security Considerations
[Auth, authorization, input validation]

## Testing Plan
[Unit tests, integration tests, e2e tests needed]

## Rollout Plan
[Feature flag? Gradual rollout? Migration needed?]

## Open Questions
- [Question 1: needs decision from PM/design]
```

---

## Day 4 (Thứ 5) — AI-Optimized Spec Writing

### Buổi sáng: What AI Needs

**AI làm tốt khi spec có:**
- Explicit data models (không để AI guess)
- Exact endpoint names và HTTP methods
- All error cases listed
- Business rules explicit (không implicit)
- Tech constraints stated ("use existing CacheService")

**AI sẽ "sáng tạo" (BAD) khi:**
- Spec không có Out of Scope
- Error cases không liệt kê
- Data model không clear
- "Handle edge cases appropriately" — vague!

### Buổi chiều: Spec-to-Code Exercise

- [ ] Viết full spec cho "Flash Sale Countdown Notification" feature:
  - 30 phút trước khi flash sale bắt đầu → notify registered users
  - User có thể register interest

- [ ] Feed spec vào AI: *"Implement this spec exactly as written"*
- [ ] Review output: bao nhiêu % đúng spec?
- [ ] Iterate spec để fix gaps

---

## Day 5 (Thứ 6) — Task Breakdown

### Buổi sáng: Task Sizing

```
Bad task: "Implement wishlist feature" (quá to, ai cũng confused)
Bad task: "Add id column" (quá nhỏ, overhead cao)
Good task: "Create WishlistService with add/remove/list methods + unit tests"
           → 1-4 hours, clear deliverable, testable
```

**Task template:**
```markdown
## Task: [Name]

**Context:** [Why this task exists — 1 sentence]
**Inputs:** [What's needed before starting]
**Outputs:** [What done looks like]
**Acceptance:** [How to verify it's done]
**Estimated:** [1h / 2h / 4h — no more than 4h]
**Dependencies:** [Previous tasks that must be complete]
```

### Buổi chiều: Break Down a Feature

- [ ] Lấy feature mày vừa spec
- [ ] Breakdown thành tasks mỗi task < 4 giờ
- [ ] Identify dependencies giữa tasks
- [ ] Estimate total time

---

## Day 6 (Thứ 7) — Personal Spec Template

### Tạo template riêng của mày:

- [ ] Viết `spec-template.md` dựa trên những gì đã học
- [ ] Customize cho FlashDeal conventions (naming, error format, v.v.)
- [ ] Test với 1 feature mới: viết spec từ template → measure time

---

## Day 7 (Chủ Nhật) — Spec Review Workshop

### Review specs của tuần:

**Checklist cho mọi spec:**
- [ ] Context rõ ràng: tại sao feature này?
- [ ] User stories: user là ai? Muốn gì?
- [ ] ACs: testable, unambiguous?
- [ ] Data model: explicit?
- [ ] APIs: request/response format?
- [ ] Errors: tất cả edge cases?
- [ ] Out of scope: rõ ràng?
- [ ] Tech constraints: nêu rõ?

---

## 📚 Tài liệu tham khảo
- [Spotify Tech Blog — Technical Spec Process](https://engineering.atspotify.com/)
- [How to Write a Good PRD](https://www.svpg.com/assets/Files/goodprd.pdf)
- [Given-When-Then](https://cucumber.io/docs/gherkin/reference/)
- Folder của mày: [specs/001-khoa-hoc/](../nestjs_ssd/specs/001-khoa-hoc/)

---

*← [Week 16](./week-16.md) | [Week 18 →](./week-18.md)*
