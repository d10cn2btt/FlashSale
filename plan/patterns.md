# Patterns & Best Practices — FlashDeal

> Ghi lại các patterns gặp trong quá trình làm project. Đọc lại trước khi implement feature mới.

---

## 1. Facade Pattern

**Ý tưởng:** Bọc một subsystem sau một interface đơn giản hơn. Giấu implementation detail khỏi caller.

**Vấn đề nó giải quyết:**
```typescript
// ❌ Không dùng Facade — logic bị lặp lại và lộ detail ở nhiều chỗ
// auth.service.ts
await redis.set(`blacklist:token:${jti}`, '1', 'EX', ttl);

// jwt-auth.guard.ts
const result = await redis.get(`blacklist:token:${jti}`);
```

```typescript
// ✅ Dùng Facade — tập trung vào RedisService
// redis.service.ts
blacklistToken(jti: string, ttl: number) {
  return this.set(`blacklist:token:${jti}`, '1', 'EX', ttl);
}
getBlacklistToken(jti: string) {
  return this.get(`blacklist:token:${jti}`);
}

// auth.service.ts
await this.redisService.blacklistToken(jti, ttl);

// jwt-auth.guard.ts
await this.redisService.getBlacklistToken(jti);
```

**Khi nào dùng:**
- Khi cùng 1 logic (key format, query phức tạp, ...) xuất hiện ở nhiều chỗ
- Khi muốn thay đổi implementation mà không ảnh hưởng caller
- Khi tên method nói lên ý nghĩa rõ hơn là đọc raw code

---

## 2. Encapsulation (Đóng gói)

**Ý tưởng:** Giấu data và logic bên trong, chỉ expose những gì cần thiết ra ngoài.

**Ví dụ trong project:**
```typescript
// ❌ Key format bị hardcode ở nhiều nơi
redis.set('blacklist:token:' + jti, ...)  // auth.service.ts
redis.get('blacklist:token:' + jti)        // jwt-auth.guard.ts
// Muốn đổi format → phải tìm và sửa tất cả
```

```typescript
// ✅ Key format được đóng gói trong RedisService
// Muốn đổi format → chỉ sửa 1 chỗ duy nhất
private tokenBlacklistKey(jti: string) {
  return `blacklist:token:${jti}`;
}
```

**Khi nào dùng:**
- String key, prefix, format lặp lại nhiều chỗ → tập trung vào 1 method/constant
- Config magic number → đặt vào named constant
- Business logic phức tạp → gói vào service method

---

## 3. Extract Method (Refactoring)

**Ý tưởng:** Khi 1 method làm quá nhiều việc → tách ra thành các method nhỏ hơn, mỗi method 1 nhiệm vụ.

**Vấn đề nó giải quyết:**
```typescript
// ❌ canActivate làm quá nhiều thứ — khó đọc, khó test
async canActivate(context: ExecutionContext) {
  // check public route
  // verify JWT
  // lấy jti
  // check redis
  // handle redis error
  // return
}
```

```typescript
// ✅ Tách ra — canActivate chỉ đọc như checklist
async canActivate(context: ExecutionContext) {
  const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  if (isPublic) return true;

  await super.canActivate(context);

  const { user } = context.switchToHttp().getRequest();
  await this.checkBlacklist(user?.jti);  // ← chi tiết bị ẩn vào đây

  return true;
}

private async checkBlacklist(jti: string) {
  try {
    const isBlacklisted = await this.redisService.getBlacklistToken(jti);
    if (isBlacklisted) {
      throw new UnauthorizedException({
        error: { code: 'TOKEN_REVOKED', message: 'Token đã bị thu hồi' },
      });
    }
  } catch (err) {
    if (err instanceof UnauthorizedException) throw err;
    throw new ServiceUnavailableException({
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Auth service tạm thời không khả dụng' },
    });
  }
}
```

**Khi nào dùng:**
- Method dài hơn 20-30 dòng → xem xét tách
- Có comment "// Bước 1", "// Bước 2" → mỗi bước là 1 method riêng
- Logic có thể tái sử dụng ở chỗ khác

---

## 4. Fail-Closed vs Fail-Open

**Ý tưởng:** Khi dependency (Redis, DB, ...) bị down, hệ thống nên xử lý thế nào?

```
Fail-open:  dependency down → bỏ qua kiểm tra → tiếp tục → ưu tiên availability
Fail-closed: dependency down → từ chối request → ưu tiên security
```

**Ví dụ trong project:**
```typescript
// JwtAuthGuard — check Redis blacklist
try {
  const isBlacklisted = await this.redisService.getBlacklistToken(jti);
  if (isBlacklisted) throw new UnauthorizedException(...);
} catch (err) {
  if (err instanceof UnauthorizedException) throw err;
  // Redis down → fail-closed: từ chối hết, không cho pass
  throw new ServiceUnavailableException(...);
}
```

**Khi nào dùng:**
- **Fail-closed:** Liên quan đến tiền, bảo mật, authentication → security > uptime
- **Fail-open:** Liên quan đến UX không quan trọng (ví dụ: feature flag, A/B test) → uptime > perfect behavior

---

## 5. Token Family Pattern (Auth)

**Ý tưởng:** Mỗi lần login tạo 1 UUID gọi là `family`. Tất cả access/refresh token của cùng 1 session dùng chung `family` này.

```
Login điện thoại → family: "AAA"
  └── Access Token  (jti: x1, family: AAA)
  └── Refresh Token (jti: y1, family: AAA)
      └── [rotation] Refresh Token mới (jti: y2, family: AAA) — family không đổi

Login laptop → family: "BBB"
  └── Access Token  (jti: x9, family: BBB)
  └── Refresh Token (jti: y9, family: BBB)
```

**Dùng vào việc gì:**

| Mục đích | Dùng cái gì |
|---|---|
| Blacklist 1 access token cụ thể | `jti` → key trong Redis |
| Logout đúng thiết bị | `family` → revoke WHERE family = ? |
| Phát hiện token theft | `family` → revoke toàn bộ family khi reuse detected |

**Code:**
```typescript
// logout — chỉ revoke thiết bị hiện tại
await this.prisma.refreshToken.updateMany({
  where: { family: payload.family, revokedAt: null },
  data: { revokedAt: new Date() },
});

// token theft detected — revoke cả session
await this.prisma.refreshToken.updateMany({
  where: { family, revokedAt: null },
  data: { revokedAt: new Date() },
});
```

---

## 6. Soft Delete vs Hard Delete

**Ý tưởng:** Thay vì xóa record khỏi DB, đánh dấu nó là "đã xóa/revoke" bằng timestamp.

```typescript
// Hard delete — mất audit trail
await prisma.refreshToken.delete({ where: { id } });

// Soft delete — giữ lại lịch sử
await prisma.refreshToken.update({
  where: { id },
  data: { revokedAt: new Date() },
});
```

**Lợi ích của soft delete/revoke:**
- Audit trail: biết token bị revoke lúc nào, từ đâu
- Phân biệt "chưa dùng" vs "đã bị revoke" → cần thiết cho Grace Period
- Token Family theft detection — nếu xóa thì không còn gì để detect

**Áp dụng rộng hơn:** `deletedAt` trên bảng `users`, `products` — xóa user không mất data lịch sử.

---

## 7. Minimize try/catch scope (Clean Error Handling)

**Ý tưởng:** `try/catch` chỉ bọc đúng đoạn code có thể throw **unexpected error** (I/O, network, DB, ...). Không bọc business logic vào trong.

```typescript
// ❌ try/catch bọc cả business logic → phải dùng instanceof để phân biệt
try {
  const isBlacklisted = await redis.get(key);
  if (isBlacklisted) {
    throw new UnauthorizedException(...); // bị catch luôn!
  }
} catch (err) {
  if (err instanceof UnauthorizedException) throw err; // phải re-throw thủ công → ugly
  throw new ServiceUnavailableException(...);
}
```

```typescript
// ✅ try/catch chỉ bọc Redis call — business logic nằm ngoài, sạch hơn
let isBlacklisted: string | null;

try {
  isBlacklisted = await redis.get(key); // chỉ bọc phần có thể lỗi bất ngờ
} catch {
  throw new ServiceUnavailableException(...);
}

if (isBlacklisted) {
  throw new UnauthorizedException(...); // nằm ngoài try/catch, rõ ràng
}
```

**Khi nào áp dụng:**
- Gọi Redis, DB, HTTP external → bọc trong try/catch
- Business logic (if/else, validation, throw custom error) → để ngoài try/catch
- Nếu trong catch mày phải `if (err instanceof X) throw err` → dấu hiệu scope quá rộng

---

## 8. Refresh Token Rotation

**Ý tưởng:** Mỗi lần dùng refresh token để lấy access token mới → refresh token cũ bị revoke, cấp refresh token mới. Dùng 1 lần duy nhất.

**Flow:**
```
Login          → cấp access-A (15m) + refresh-A (7d)
Refresh lần 1  → refresh-A bị revoke → cấp access-B + refresh-B (mới)
Refresh lần 2  → refresh-B bị revoke → cấp access-C + refresh-C (mới)
...
```

**Tại sao cần Rotation:**
```
Không rotation: refresh-A sống 7 ngày, dùng bao nhiêu lần cũng được
  → Bị steal → kẻ xấu dùng 7 ngày không ai biết ❌

Có rotation: mỗi refresh token chỉ dùng 1 lần
  → Bị steal → kẻ xấu dùng → token cũ bị revoke
  → User refresh tiếp → "token đã bị revoke" → TOKEN_REUSE_DETECTED
  → Revoke cả family → cả 2 bị đá ra → user biết có chuyện ✅
```

**3 case khi gọi POST /auth/refresh:**

| Case | revokedAt | Thời gian | Kết quả |
|---|---|---|---|
| Token hợp lệ | NULL | — | Rotation bình thường ✅ |
| Multi-tab race | != NULL | < 5 giây | `TOKEN_REVOKED` — reject nhẹ |
| Token theft | != NULL | >= 5 giây | `TOKEN_REUSE_DETECTED` — revoke toàn bộ family |

**DB state qua từng bước:**
```
Sau login:
  #1 | refresh-A | revokedAt: NULL

Sau refresh lần 1 (dùng refresh-A):
  #1 | refresh-A | revokedAt: 10:00:00  ← revoke cũ
  #2 | refresh-B | revokedAt: NULL      ← cấp mới

Kẻ xấu dùng lại refresh-A sau 60s:
  Tìm #1 → revokedAt = 10:00:00, now = 10:01:00
  → 60s >= 5s → TOKEN_REUSE_DETECTED
  → Revoke tất cả WHERE family = family của #1 (bao gồm #2)
  → Cả kẻ xấu + user đều bị đá ra
```

**Key points:**
- `family` = UUID tạo lúc login, dùng chung cho tất cả token của 1 session
- Không xóa record khỏi DB → giữ để detect reuse (xem Pattern #6 Soft Delete)
- Grace period 5 giây để tránh false positive khi nhiều tab cùng refresh

---

## 9. Error Factory

**Ý tưởng:** Tập trung error codes + messages vào 1 file, thay vì `new XxxException({ error: {...} })` rải rác khắp service.

```typescript
// ❌ Hardcode rải rác — đổi message phải tìm khắp codebase
throw new UnauthorizedException({ error: { code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng' } });
// ... chỗ khác cũng throw y chang
throw new UnauthorizedException({ error: { code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng' } });
```

```typescript
// ✅ src/common/errors/auth.errors.ts
export const AuthErrors = {
  emailTaken:          () => new ConflictException({ error: { code: 'EMAIL_TAKEN', ... } }),
  invalidCredentials:  () => new UnauthorizedException({ error: { code: 'INVALID_CREDENTIALS', ... } }),
  tokenReuseDetected:  () => new UnauthorizedException({ error: { code: 'TOKEN_REUSE_DETECTED', ... } }),
  serviceUnavailable:  () => new ServiceUnavailableException({ error: { code: 'SERVICE_UNAVAILABLE', ... } }),
};

// Dùng trong service:
throw AuthErrors.invalidCredentials();
throw AuthErrors.tokenReuseDetected();
```

**Cấu trúc thư mục:**
```
src/common/errors/
  auth.errors.ts   ← errors của Auth module
  user.errors.ts   ← errors của User module (sau này)
```

**Khi nào dùng:** Module có nhiều loại error khác nhau, throw ở nhiều chỗ khác nhau.

---

*← [README](./README.md)*
