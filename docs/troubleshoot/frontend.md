# Frontend Troubleshoot Log

> Ghi lại các lỗi thực tế gặp phải khi dev. Format: Lỗi → Nguyên nhân → Solution → Why.

---

*Chưa có lỗi nào được ghi nhận. Sẽ cập nhật khi phát sinh.*

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

