# Frontend Troubleshoot Log

> Ghi lại các lỗi thực tế gặp phải khi dev. Format: Lỗi → Nguyên nhân → Solution → Why.

---

---

## [FE-002] F5 (refresh trang) bị redirect về `/login` dù đã đăng nhập

**Ngày:** 2026-03-04  
**Tuần:** Week 1 / Day 6  
**Triệu chứng:**

Login thành công → vào dashboard → F5 → bị redirect về `/login`. DevTools → Application → Cookies: trống.

---

### Nguyên nhân

Có 3 lỗi kết hợp:

**1. Backend trả `refreshToken` trong body, FE không lưu:**
```ts
// auth.service.ts trả về:
return { accessToken, refreshToken }; // trong body

// auth.context.tsx chỉ lấy accessToken, bỏ qua refreshToken:
setAccessToken(loginRes.data.data.accessToken); // refreshToken bị discard!
```

**2. Frontend gọi `/auth/refresh` với body rỗng:**
```ts
// client.ts interceptor:
await axios.post('/auth/refresh', {}, { withCredentials: true });
//                               ↑ body rỗng!

// Trong khi backend expect refreshToken trong body:
async refresh(@Body('refreshToken') refreshToken: string) // undefined → verify fail
```

**3. `apiClient` thiếu `withCredentials: true`:**

Dù backend có set `Set-Cookie` header, browser không lưu cookie vì request login không có `withCredentials: true`. Trong Axios, `withCredentials` chỉ được set trên call `/auth/refresh`, không set globally.

---

### Solution

**Backend:** Chuyển từ trả `refreshToken` trong body → set httpOnly cookie:

```ts
// auth.controller.ts
async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
  const { accessToken, refreshToken } = await this.authService.login(loginDto);
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
    path: '/api/v1/auth',
  });
  return { data: { accessToken } };
}

// refresh: đọc từ cookie thay vì body
async refresh(@Req() req: Request) {
  const refreshToken = req.cookies['refreshToken'];
  ...
}

// logout: clear cookie
async logout(..., @Res({ passthrough: true }) res: Response) {
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  ...
}
```

**Frontend:** Set `withCredentials: true` globally trên `apiClient`:

```ts
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true, // ← gửi/nhận cookie cho mọi request
});
```

---

### Why

| Vấn đề | Lý do kỹ thuật |
|---|---|---|
| Cookie không được lưu | Axios mặc định không gửi credentials cho cross-origin request. Phải set `withCredentials: true` |
| Browser block Set-Cookie | Cross-origin (port 3000 → 5000): browser chặn cookie nếu không có `withCredentials` và CORS `credentials: true` |
| httpOnly cookie an toàn hơn body | JS không đọc được → XSS không thể đánh cắp refresh token |
| `path: '/api/v1/auth'` | Cookie chỉ gửi đến `/auth/*`, không gửi đi lung tung vào mọi API endpoint |

---

## [FE-001] Can't resolve 'tailwindcss' / 'axios' / 'scheduler' trong monorepo

**Ngày:** 2026-03-03
**Tuần:** Week 1 / Day 5
**Triệu chứng:**
```
Error: Can't resolve 'tailwindcss' in 'D:\SAP\project\flashdeal'
Error: Can't resolve 'axios' in 'D:\SAP\project\flashdeal'
Module not found: Can't resolve 'scheduler'
```
Warning đi kèm:
```
⚠ Next.js inferred your workspace root...
selected D:\SAP\project\flashdeal\package-lock.json as root
```

---

### Nguyên nhân

Root folder có `package-lock.json` (do root `package.json` có `"workspaces"`). Next.js Turbopack tự detect workspace root bằng cách tìm `package-lock.json` — khi thấy file ở thư mục cha → tưởng root là thư mục cha → tìm packages sai chỗ.

---

### Solution

**Xóa `package-lock.json` ở root monorepo.**

Mỗi project (`frontend/`, `backend/`) đã có `package-lock.json` riêng → file ở root thừa và gây confused cho Turbopack.

```bash
rm package-lock.json   # chạy từ thư mục gốc D:\SAP\project\flashdeal
```

---

### Why — Hiểu sâu hơn

| Câu hỏi | Giải thích |
|---|---|
| Tại sao Next.js nhầm? | Turbopack tìm `package-lock.json` để detect workspace root, thấy file ở thư mục cha → chọn nó làm root |
| Tại sao `tailwindcss` resolve được từ `frontend/` nhưng `axios` thì không? | `tailwindcss` cài trong `frontend/node_modules/`, còn `axios` bị npm workspaces hoist lên root `node_modules/` — 2 thứ nằm ở 2 chỗ |
| Tại sao xóa root `package-lock.json` fix được? | Turbopack không còn tìm thấy lockfile ở thư mục cha → tự dùng `frontend/package-lock.json` → detect đúng root |

---

### Lesson learned

> Monorepo có root `package-lock.json` + npm workspaces sẽ khiến Turbopack detect sai workspace root → resolve modules sai chỗ. Giải pháp đơn giản nhất: xóa root `package-lock.json` nếu không dùng workspaces thực sự.

---

## Template (copy khi thêm lỗi mới)

```
## [FE-XXX] Tiêu đề lỗi ngắn gọn

**Ngày:** YYYY-MM-DD  
**Tuần:** Week X / Day X  
**Triệu chứng:**
(error message / behavior)

---

### Nguyên nhân

(giải thích kỹ thuật)

---

### Solution

(từng bước fix)

---

### Why — Hiểu sâu hơn

| Câu hỏi | Giải thích |
|---|---|
| ... | ... |

---

### Lesson learned

> ...
```

