# Week 01 — Review & Reflection

> Ngày: 2026-03-04
> Không nhìn tài liệu — tự trả lời rồi so sánh

---

## 4 câu hỏi tự kiểm tra

---

### 1. Tại sao cần refresh token?

**Câu trả lời của mày (đúng hướng):**
> Access token hết hạn → client dùng refresh token để lấy access token mới mà không cần login lại. Refresh token khi được cấp mới thì xóa token cũ.

**Bổ sung — Refresh Token Rotation + Grace Period:**

Mỗi lần dùng refresh token → token cũ bị `revoke` ngay, cấp cặp mới cùng `family`. Logic xử lý:

```
Token đã revoke < 5 giây (Grace Period)?
  → Reject nhẹ (throw tokenRevoked)
  → Không nuclear
  → Lý do: multi-tab race condition
     Tab A + Tab B cùng hết access token
     Tab A refresh xong → revoke token cũ → cấp token mới
     Tab B (50ms sau) dùng token cũ → bị revoke nhưng chưa quá 5s
     → Không phải hacker, chỉ là race condition bình thường

Token đã revoke >= 5 giây?
  → TOKEN THEFT xác nhận
  → Revoke TOÀN BỘ family (tất cả thiết bị trong session đó)
  → throw tokenReuseDetected
```

**Tại sao cần 2 token thay vì 1?**
- Access token: short-lived (15m), stateless, không cần check DB mỗi request
- Refresh token: long-lived (7d), stateful (lưu DB), dùng ít hơn
- Nếu chỉ 1 token long-lived → logout không thật (token vẫn valid), bị compromise là mất 7 ngày

---

### 2. Redis blacklist hoạt động thế nào?

**Câu trả lời của mày (nhầm):**
> Redis blacklist dùng khi phát hiện token reuse > 5s

**Đúng — Redis blacklist dùng cho ACCESS TOKEN khi logout:**

```
Logout flow:
  1. Client gửi request POST /auth/logout (kèm access token)
  2. BE decode access token → lấy jti (unique ID của token) + exp
  3. TTL = exp - now (thời gian còn lại)
  4. Redis: SET blacklist:token:{jti} 1 EX {ttl}
  5. Mọi request sau dùng access token này → JwtAuthGuard check Redis → block

Tại sao set TTL = thời gian còn lại?
  → Token đã hết hạn tự nhiên không cần blacklist nữa → tránh phình Redis
```

**Token theft detection (reuse > 5s) dùng DB (PostgreSQL), không phải Redis:**
```
Refresh token có cột revokedAt trong DB
Khi reuse phát hiện → revoke toàn bộ family trong DB
```

**Fail-closed pattern:**
```
Redis down khi logout → throw 503 (không cho logout thành công)
Lý do: nếu allow logout khi Redis down → token vẫn valid → security hole
Security > Availability
```

---

### 3. httpOnly cookie là gì, tại sao quan trọng?

**Câu trả lời của mày (đúng):**
> BE set cookie qua `res.cookie()`, browser tự lưu và tự đính vào mỗi request. Dùng để lưu refresh token, tự gửi lên khi cần refresh mà user không biết.

**Điểm quan trọng nhất mày bỏ sót:**

`httpOnly` = **JavaScript không đọc được cookie này**.

```javascript
// Dù hacker inject JS vào trang (XSS attack):
document.cookie // → không thấy refreshToken
localStorage.getItem('refreshToken') // → có thể thấy nếu lưu ở đây

// httpOnly cookie hoàn toàn ẩn với JS → XSS không lấy được
```

**So sánh cách lưu token:**

| Cách lưu | XSS | CSRF | Ghi chú |
|---|---|---|---|
| localStorage | ❌ JS đọc được | ✓ | Không nên dùng cho refresh token |
| sessionStorage | ❌ JS đọc được | ✓ | Mất khi đóng tab |
| httpOnly Cookie | ✓ JS không đọc | ⚠️ Cần `sameSite` | Best practice |

**`sameSite: strict`** giải quyết CSRF: cookie chỉ được gửi khi request xuất phát từ cùng domain.

---

### 4. Module trong NestJS khác Provider thế nào?

**Câu trả lời của mày:** Không biết

**Giải thích:**

**Provider** (`@Injectable()`):
- Một class cung cấp logic cụ thể
- Ví dụ: `AuthService`, `JwtStrategy`, `JwtAuthGuard`, `PrismaService`
- Được inject vào nơi khác qua constructor (Dependency Injection)

**Module** (`@Module()`):
- Đóng gói và tổ chức các Provider liên quan thành 1 nhóm
- Kiểm soát scope: cái gì dùng nội bộ, cái gì export ra ngoài

```typescript
@Module({
  imports: [JwtModule],           // module khác cần dùng
  controllers: [AuthController],  // handle HTTP request
  providers: [
    AuthService,    // internal
    JwtStrategy,    // internal
    JwtAuthGuard,   // internal
  ],
  exports: [AuthService], // chỉ AuthService được module khác inject
})
export class AuthModule {}
```

**So sánh với Laravel:**

| Laravel | NestJS |
|---|---|
| `ServiceProvider` | `Module` |
| `Service` / `Repository` | `Provider` (`@Injectable()`) |
| `bind()` / `singleton()` trong ServiceProvider | `providers: []` trong Module |
| `app()->make(Service::class)` | Constructor injection |

---

## Confuse / Cần tìm hiểu thêm

- [ ] Token Family: mỗi thiết bị 1 family hay mỗi lần login 1 family? → Hiện tại: mỗi lần login = 1 family mới
- [ ] Khi nào nên dùng Redis Sentinel vs Redis Cluster?
- [ ] Circuit breaker pattern cho Redis down — Week 8+

---

## So sánh NestJS vs Laravel sau Week 1

| | Laravel | NestJS |
|---|---|---|
| DI Container | Service Container (`app()->bind`) | Module + `@Injectable()` |
| Routing | `routes/api.php` | `@Controller()` + `@Get/@Post` decorator |
| Middleware | `Middleware` class | `Guard` (mạnh hơn, có access DI) |
| Validation | `FormRequest` | `DTO` + `class-validator` |
| Auth | Sanctum/Passport (1 token) | JWT custom (2 token + rotation) |
| ORM | Eloquent (Active Record) | Prisma (Data Mapper — tường minh hơn) |
| Config | `.env` + `config()` | `ConfigModule` + `process.env` |
