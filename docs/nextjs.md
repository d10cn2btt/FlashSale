# NextJS — Concepts & Q&A

> Ghi lại các câu hỏi + giải thích trong quá trình học. Cập nhật theo từng ngày.

---

## Day 5 — Auth System (AuthContext + Interceptor)

---

### 1. AuthContext dùng `useState` — có phải lưu memory của toàn hệ thống không?

**Câu trả lời:** Không phải 1 mình nó. Có **2 loại memory song song**:

| | `accessToken` trong `client.ts` | `user` trong `auth.context.tsx` |
|---|---|---|
| Loại | JS module variable | React state (`useState`) |
| Ai đọc | axios interceptor (ngoài React tree) | React components (qua `useAuth()`) |
| Khi đổi | Không re-render | Re-render UI |
| Mục đích | Gắn vào HTTP Authorization header | Hiển thị thông tin user lên màn hình |

Cả 2 phải được set đồng thời trong `login()`, và xóa đồng thời trong `logout()`.

---

### 2. `accessToken` trong `client.ts` chỉ là biến JS thường phải không?

**Câu trả lời:** Đúng. Chỉ là:

```ts
let accessToken: string | null = null;
```

Không có gì đặc biệt. Điểm khác biệt duy nhất là **module scope**:

```
Biến trong function  → mất khi function chạy xong
Biến trong module    → tồn tại suốt vòng đời tab browser (cho đến khi F5 / đóng tab)
```

Vì `client.ts` được import 1 lần duy nhất → module chạy 1 lần → biến tồn tại xuyên suốt.  
Bất kỳ file nào import `setAccessToken` / `getAccessToken` đều đọc/ghi vào **cùng 1 biến** — đây là tính chất **module singleton** trong JS.

---

### 3. F5 thì các loại storage có mất không?

**Câu trả lời:** Cả module variable và React state đều mất khi F5:

| | Module variable (`accessToken`) | React state (`user`) | httpOnly Cookie (refresh token) |
|---|---|---|---|
| F5 | **Mất** | **Mất** | **Còn** |
| Vai trò sau F5 | Được restore | Được restore | "Chìa khóa" để restore 2 cái kia |

**Flow restore sau F5:**

```
F5 → app load
 ↓
AuthProvider mount → useEffect chạy → gọi GET /auth/me
 ↓
Không có accessToken → 401
 ↓
Interceptor tự gọi POST /auth/refresh (browser gửi kèm httpOnly cookie)
 ↓
Backend trả accessToken mới
 ↓
setAccessToken(newToken)  ← module variable có lại
retry GET /auth/me        ← thành công
 ↓
setUser(user)             ← React state có lại
 ↓
UI hiện đúng trạng thái logged in ✓
```

**Kết luận:** httpOnly cookie là "nguồn sự thật" duy nhất survive qua F5. Mọi thứ khác đều được restore từ nó.

---

### 4. Giải thích các React hooks dùng trong AuthContext

---

#### `useState` — lưu dữ liệu, tự động cập nhật UI

**Vấn đề nó giải quyết:**  
JS bình thường: mày thay đổi biến → UI không biết → không cập nhật.  
`useState`: mày thay đổi state → React tự re-render → UI cập nhật.

**Cú pháp:**
```ts
const [state, setState] = useState(giáTrịBanĐầu);
```

**Ví dụ thực tế trong project:**
```ts
const [user, setUser] = useState<AuthUser | null>(null);

// Đọc
console.log(user); // null lúc đầu

// Thay đổi → React tự render lại
setUser({ id: '1', email: 'a@b.com', name: 'John', role: 'USER' });

// Xóa
setUser(null);
```

**Rule bắt buộc — không được gán trực tiếp:**
```ts
user = { ... }   // ❌ React không hay biết → UI không cập nhật
setUser({ ... }) // ✅ React biết → re-render
```

**Khi nào dùng:** Khi cần lưu dữ liệu mà thay đổi phải phản ánh lên UI.

---

#### `useEffect` — chạy code sau khi render

**Vấn đề nó giải quyết:**  
Đôi khi mày cần làm gì đó *sau khi* component hiển thị xong — gọi API, set up listener, v.v. Không thể làm thẳng trong body component vì nó chạy mỗi lần render.

**Cú pháp:**
```ts
useEffect(() => {
  // code chạy sau render
}, [dependencies]);
```

**3 cách dùng — khác nhau ở dependency array:**

```ts
// 1. Chạy sau MỖI lần render (ít dùng, dễ loop vô hạn)
useEffect(() => {
  console.log('render!');
});

// 2. Chỉ chạy 1 lần khi mount ([] rỗng) ← hay dùng nhất
useEffect(() => {
  restoreSession(); // gọi API check session 1 lần khi app load
}, []);

// 3. Chạy lại khi biến trong [] thay đổi
useEffect(() => {
  console.log('user changed:', user);
}, [user]); // chạy mỗi khi user thay đổi
```

**Ví dụ thực tế trong project:**
```ts
useEffect(() => {
  const restoreSession = async () => {
    try {
      const response = await apiClient.get('/auth/me');
      setUser(response.data.data.user); // set user sau khi mount
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  restoreSession();
}, []); // [] = chỉ chạy 1 lần khi AuthProvider mount
```

**Khi nào dùng:** Gọi API, subscribe event, set up timer, sau khi component xuất hiện trên màn hình.

---

#### `createContext` + `useContext` — truyền dữ liệu không cần props

**Vấn đề nó giải quyết:**  
Không có Context, mày phải truyền `user` từ component cha → con → cháu... qua props từng tầng:

```
App (có user)
  └── Layout (nhận user prop, truyền tiếp)
        └── Header (nhận user prop, truyền tiếp)
              └── Avatar (nhận user prop, dùng)
```

Với Context:
```
App
  └── AuthProvider (giữ user)
        └── Layout      ← không cần prop
              └── Header  ← không cần prop
                    └── Avatar ← gọi useAuth().user là xong
```

**Cú pháp — 3 bước:**

```ts
// Bước 1: Tạo Context (thường ở file riêng)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Bước 2: Provider — bọc quanh những component cần dùng
<AuthContext.Provider value={{ user, login, logout }}>
  {children}
</AuthContext.Provider>

// Bước 3: Đọc Context từ bất kỳ component con nào
const { user, login } = useContext(AuthContext);
```

**Trong project dùng custom hook `useAuth()` để đơn giản hơn:**
```ts
// Thay vì viết ở mỗi component:
const context = useContext(AuthContext);

// Chỉ cần:
const { user, login, logout } = useAuth();
```

**Khi nào dùng:** Dữ liệu cần share cho nhiều component ở nhiều tầng khác nhau (auth state, theme, language...).

---

#### So sánh `useState` vs `useEffect` vs `useContext`

| | `useState` | `useEffect` | `useContext` |
|---|---|---|---|
| Mục đích | Lưu dữ liệu | Chạy code sau render | Đọc dữ liệu từ Context |
| Trigger re-render | ✅ Có (khi set) | ❌ Không | ❌ Không (chỉ đọc) |
| Thường dùng cho | User state, loading, form | Gọi API, timer, event | Auth, theme, global state |
| Analogy | Biến có "sensor" | Cron job sau render | Biến toàn cục có kiểm soát |

---

#### `'use client'` — Next.js directive (không phải React hook)

**Vấn đề nó giải quyết:**  
Next.js mặc định render component ở **server** (không có browser, không có DOM). Nhưng `useState`, `useEffect`, `useContext` đều cần browser để chạy.

```ts
'use client'; // ← phải đặt ở dòng đầu tiên của file
```

**Rule đơn giản:**  
Nếu file dùng bất kỳ hook nào (`useState`, `useEffect`...) hoặc cần tương tác browser (click, DOM...) → phải có `'use client'`.

```ts
// ✅ Server Component (không cần 'use client')
// - Fetch data từ DB
// - Render HTML tĩnh
// - Không có state, không có event

// ✅ Client Component (cần 'use client')
// - Dùng useState, useEffect
// - Có onClick, onChange
// - Dùng Context
```

**Khi nào dùng:** Mọi file dùng React hooks hoặc browser API.

---

### 5. Cú pháp `const [user, setUser] = useState<AuthUser | null>(null)` nghĩa là gì?

```ts
const [user, setUser] = useState<AuthUser | null>(null);
//     ↑      ↑                  ↑               ↑
//   state  setter            kiểu dữ liệu    giá trị ban đầu
```

**`useState<AuthUser | null>`** — TypeScript generic

Nói với TypeScript: "biến này chỉ được phép chứa `AuthUser` hoặc `null`":

```ts
setUser({ id: '1', email: 'a@b.com', ... }) // ✅ AuthUser
setUser(null)                                 // ✅ null
setUser('hello')                              // ❌ TypeScript báo lỗi
setUser(123)                                  // ❌ TypeScript báo lỗi
```

**`(null)`** — giá trị khởi tạo

Khi component mount lần đầu, `user = null` — chưa biết ai đăng nhập. `restoreSession` trong `useEffect` sẽ set lại sau.

**`const [user, setUser]`** — array destructuring

`useState` trả về 1 array gồm 2 phần tử:

```ts
const result = useState(null);
const user    = result[0]; // đọc state
const setUser = result[1]; // hàm để thay đổi state

// Viết tắt bằng destructuring:
const [user, setUser] = useState(null);
```

**Rule quan trọng:** Muốn thay đổi state → **bắt buộc dùng `setUser()`**, không được gán trực tiếp:

```ts
user = { ... }      // ❌ React không biết → không re-render
setUser({ ... })    // ✅ React biết → re-render
```

---

### 6. Bug gặp phải khi code AuthContext

**Bug 1 — `apiClient.get()` trả về AxiosResponse, không phải data trực tiếp**

```ts
// ❌ Sai — user ở đây là AxiosResponse object, không phải AuthUser
const user = await apiClient.get<AuthUser>('/auth/me');
setUser(user);

// ✅ Đúng — lấy đúng field từ response theo convention { data: { user } }
const response = await apiClient.get('/auth/me');
setUser(response.data.data.user);
```

**Bug 2 — `AuthContext.Provider` thiếu `{children}` bên trong**

```tsx
// ❌ Sai — children không được render → màn hình trắng
<AuthContext.Provider value={{...}}></AuthContext.Provider>

// ✅ Đúng
<AuthContext.Provider value={{...}}>
  {children}
</AuthContext.Provider>
```

---

## React + Next.js — Lifecycle & Workflow tổng quan

---

### React Component Lifecycle

Mỗi component React trải qua 3 giai đoạn:

```
1. MOUNT      → component xuất hiện lần đầu trên màn hình
2. UPDATE     → state / props thay đổi → re-render
3. UNMOUNT    → component bị xóa khỏi màn hình
```

**Mapping với hooks:**

```
MOUNT   → useEffect(() => { ... }, [])   ← [] rỗng = chạy khi mount
UPDATE  → useState setter được gọi       ← trigger re-render
UNMOUNT → useEffect return cleanup fn    ← dọn dẹp (hủy timer, listener...)
```

**Ví dụ đầy đủ:**
```tsx
function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // khởi tạo state

  useEffect(() => {
    // --- MOUNT: chạy 1 lần khi component xuất hiện ---
    restoreSession();

    // --- UNMOUNT: cleanup khi component bị xóa ---
    return () => {
      // hủy subscription, clear timer nếu có
    };
  }, []);

  // --- UPDATE: mỗi lần setUser() được gọi → re-render ---
  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>;
}
```

---

### Next.js Rendering — 3 loại

Next.js có 3 cách render khác nhau, chọn sai thì chậm hoặc bug:

```
SSR  — Server Side Rendering  → render trên server mỗi request
SSG  — Static Site Generation → render 1 lần lúc build, file HTML tĩnh
CSR  — Client Side Rendering  → render trên browser (giống React thuần)
```

**So sánh:**

| | SSR | SSG | CSR |
|---|---|---|---|
| Render ở đâu | Server (mỗi request) | Server (lúc build) | Browser |
| Dữ liệu | Luôn mới nhất | Cũ (đến lần build tiếp) | Fetch sau khi load |
| SEO | ✅ Tốt | ✅ Tốt | ❌ Kém |
| Tốc độ | Trung bình | ✅ Nhanh nhất | Chậm lần đầu |
| Dùng cho | Dashboard, auth pages | Blog, landing page | Interactive UI |

**Trong FlashDeal:**
```
Login/Register page  → CSR ('use client' + useState)
Dashboard            → CSR (cần auth state từ Context)
Product listing      → SSR hoặc SSG (SEO tốt, data từ DB)
```

---

### Next.js App Router — Workflow khi user request

```
User gõ URL
     ↓
Next.js Server nhận request
     ↓
Tìm file trong app/ khớp với route
     ↓
      ┌─────────────────────────────────┐
      │  Server Component (mặc định)    │
      │  - Render HTML trên server      │
      │  - Không có state, không hook   │
      │  - Fetch DB trực tiếp được      │
      └────────────┬────────────────────┘
                   ↓
           Gửi HTML về browser
                   ↓
      ┌─────────────────────────────────┐
      │  Client Component ('use client')│
      │  - Hydration: React "chiếm"     │
      │    HTML tĩnh, gắn event vào     │
      │  - useState, useEffect chạy     │
      │  - useEffect mount → gọi API   │
      └─────────────────────────────────┘
```

**Hydration là gì?**  
Server gửi HTML tĩnh về browser (người dùng thấy ngay, không trắng màn hình).  
React sau đó "hydrate" — gắn event listeners, khởi tạo state, chạy useEffect.  
Đây là lý do tại sao Next.js vừa load nhanh vừa interactive.

---

### Workflow cụ thể trong FlashDeal khi F5

```
1. Browser request GET /dashboard
        ↓
2. Next.js server render HTML của dashboard page
   (lúc này chưa biết user là ai — server không có React state)
        ↓
3. Gửi HTML về browser → user thấy layout ngay
        ↓
4. React hydrate — 'use client' components bắt đầu chạy
        ↓
5. AuthProvider mount → useEffect chạy → gọi GET /api/v1/auth/me
        ↓
6. Interceptor thấy không có accessToken → gọi /auth/refresh
   (browser tự gửi httpOnly cookie)
        ↓
7. Nhận accessToken mới → retry /auth/me → nhận user
        ↓
8. setUser(user) → AuthProvider re-render → isLoading = false
        ↓
9. Dashboard layout đọc useAuth() → isAuthenticated = true → hiển thị nội dung
```

**Tại sao cần `isLoading`?**  
Bước 5→9 mất vài trăm ms. Trong thời gian đó `user = null` → nếu không check `isLoading`, protected route sẽ tưởng chưa login và redirect về `/login` ngay.

```tsx
// Trong protected layout:
if (isLoading) return <Spinner />; // chờ check session xong
if (!isAuthenticated) redirect('/login'); // chắc chắn chưa login
return <>{children}</>; // đã login
```

---

### File structure — ai render ở đâu trong FlashDeal

```
app/
  layout.tsx              ← Server Component (wrap AuthProvider)
  page.tsx                ← Server Component (landing page)

  (auth)/                 ← Route group — không tạo URL segment
    login/page.tsx        ← Client Component ('use client' — có form)
    register/page.tsx     ← Client Component ('use client' — có form)

  (dashboard)/            ← Route group — protected
    layout.tsx            ← Client Component ('use client' — cần useAuth())
    page.tsx              ← Server hoặc Client tùy nội dung

contexts/
  auth.context.tsx        ← Client Component ('use client' — có useState)
```

**Route group `(tên)` là gì?**  
Tên trong ngoặc tròn không xuất hiện trong URL. Dùng để nhóm file có cùng layout mà không ảnh hưởng routing:
```
app/(auth)/login/page.tsx   → URL: /login    (không có /auth/ trong URL)
app/(dashboard)/page.tsx    → URL: /         (không có /dashboard/ trong URL)
```

---

### 7. Protected Route Layout — các case đặc biệt

#### Tại sao dùng `useEffect` thay vì `if` trực tiếp để redirect?

```tsx
// ❌ Sai — không được gọi router.push() trong lúc render
if (!isAuthenticated) {
  router.push('/login'); // lỗi runtime: side effect trong render
}

// ✅ Đúng — đặt trong useEffect, chạy SAU khi render xong
useEffect(() => {
  if (!isLoading && !isAuthenticated) {
    router.push('/login');
  }
}, [isLoading, isAuthenticated, router]);
```

**Rule:** Mọi side effect (router, API call, DOM manipulation...) → phải đặt trong `useEffect`, không được gọi trực tiếp trong body component.

---

#### Tại sao phải check `!isLoading` trước khi redirect?

```
App load lần đầu:
  isLoading = true
  user = null (chưa restore session)

Nếu không check isLoading:
  !isAuthenticated = true → redirect /login ngay
  → dù user đã login, vẫn bị đá ra /login → BUG

Đúng phải:
  isLoading = true → chờ
  isLoading = false + !isAuthenticated → redirect (chắc chắn chưa login)
  isLoading = false + isAuthenticated  → render dashboard
```

```tsx
// ❌ Thiếu check isLoading → bug khi F5
if (!isAuthenticated) router.push('/login');

// ✅ Check đủ cả 2
if (!isLoading && !isAuthenticated) router.push('/login');
```

---

#### Tại sao return `null` 2 lần thay vì 1?

```tsx
if (isLoading) return null;       // (1) đang restore session
if (!isAuthenticated) return null; // (2) chờ redirect chạy xong
return children;                   // (3) authenticated → render
```

**(1)** — Đang check session, chưa biết user là ai. Không render gì để tránh layout flash.

**(2)** — Session check xong, không authenticated. `useEffect` đã gọi `router.push('/login')` nhưng redirect chưa xảy ra ngay lập tức. Nếu không return null ở đây → dashboard render trong tích tắc rồi mới redirect → user thấy nội dung flash qua.

**Pattern này gọi là "prevent content flash"** — ẩn nội dung trong khi đang redirect.

---

---

## Week 2 / Day 5 — Flash Sale UI + Order flow

---

### 1. Server Component vs Client Component — khi nào dùng cái nào?

**Rule đơn giản:**

| Cần gì | Dùng |
|--------|------|
| `useState`, `useEffect`, hook bất kỳ | Client Component (`'use client'`) |
| `onClick`, `onChange`, event handler | Client Component |
| Dùng Context (`useAuth()`, v.v.) | Client Component |
| Chỉ render HTML tĩnh, không state | Server Component (mặc định) |
| Fetch DB trực tiếp, SEO | Server Component |

**Trong FlashDeal — tất cả dashboard pages là Client Component vì:**
- Cần `accessToken` từ memory (chỉ có trên browser)
- Cần `useState` để quản lý loading / data / error
- Cần `useAuth()` để check authenticated

**Server Component duy nhất trong project hiện tại:** `app/page.tsx` — landing page tĩnh, không fetch, không state.

---

### 2. API Service Layer pattern

Tách API calls ra file riêng trong `lib/api/`:

```
lib/api/
  client.ts       ← axios instance + interceptors (HOW to request)
  flash-sale.ts   ← flash sale endpoints (WHAT to request)
  order.ts        ← order endpoints
```

**`client.ts`** lo transport: gắn Bearer token, handle 401, retry với refresh token.
**`flash-sale.ts`** lo business: endpoint nào, data shape nào.

```ts
// flash-sale.ts
export const flashSaleApi = {
  getActive: () => apiClient.get('/flash-sales/active').then(r => r.data),
  getById: (id: string) => apiClient.get(`/flash-sales/${id}`).then(r => r.data),
};

// Dùng trong page — không cần biết apiClient là gì
const data = await flashSaleApi.getActive();
```

Tương tự NestJS: `PrismaService` = transport, `ProductService` = business logic.

---

### 3. `setState` callback form — tránh stale closure

```ts
// ❌ Có thể dùng flashSales cũ (stale closure)
setFlashSales([...flashSales, newItem]);

// ✅ prev luôn là giá trị mới nhất tại thời điểm setter chạy
setFlashSales((prev) => prev.map((s) =>
  s.id === id ? { ...s, soldQty: s.soldQty + 1 } : s
));
```

**Stale closure xảy ra khi:** function được tạo tại thời điểm A, nhưng chạy tại thời điểm B — lúc đó biến `flashSales` trong closure vẫn là giá trị tại A.
Callback form nhận `prev` từ React → luôn đúng.

---

### 4. Local state update vs refetch

Sau khi mutation (mua hàng thành công), có 2 cách update UI:

```ts
// Cách 1: Refetch — gọi lại API lấy data mới
await orderApi.create(flashSaleId);
const fresh = await flashSaleApi.getActive(); // thêm 1 round trip
setFlashSales(fresh.data);

// Cách 2: Local update — tính toán state mới ngay trên client
await orderApi.create(flashSaleId);
setFlashSales((prev) =>
  prev.map((s) => s.id === flashSaleId ? { ...s, soldQty: s.soldQty + 1 } : s)
);
```

**Cách 2 dùng khi:** biết chính xác data thay đổi như thế nào (soldQty +1).
**Cách 1 dùng khi:** mutation phức tạp, không chắc server thay đổi gì.

---

#### `context ?? {}` là thừa khi dùng `useAuth()`

```tsx
// ❌ Thừa — useAuth() đã throw nếu dùng ngoài Provider
const context = useAuth();
const { isLoading, isAuthenticated } = context ?? {};

// ✅ Gọn hơn — useAuth() đảm bảo luôn có giá trị
const { isLoading, isAuthenticated } = useAuth();
```

`useAuth()` bên trong đã có guard:
```ts
if (!context) throw new Error('useAuth must be used within AuthProvider');
```
→ Nếu không có Provider thì throw, không bao giờ trả về `undefined` → `?? {}` không bao giờ được dùng đến.

---
