/**
 * Race Condition Demo Script
 *
 * Gửi N request đồng thời đến POST /orders
 * Mục đích: quan sát overselling khi không có protection
 *
 * Chạy: node scripts/race-condition-test.mjs
 */

const BASE_URL = 'http://localhost:5000/api/v1';
const CONCURRENT = 20; // số request đồng thời

// ─────────────────────────────────────────
// 1. Login để lấy access token
// ─────────────────────────────────────────
async function login() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alice@example.com', password: 'Password123!' }),
    credentials: 'include',
  });
  const data = await res.json();
  return data.data.accessToken;
}

// ─────────────────────────────────────────
// 2. Lấy flash sale ACTIVE đầu tiên
// ─────────────────────────────────────────
async function getActiveFlashSaleId() {
  const res = await fetch(`${BASE_URL}/flash-sales/active`);
  const data = await res.json();
  if (!data.data?.length) throw new Error('Không có flash sale active. Chạy seed lại!');
  return data.data[0].id;
}

// ─────────────────────────────────────────
// 3. Gửi 1 order request
// ─────────────────────────────────────────
async function placeOrder(token, flashSaleId, index) {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ flashSaleId }),
  });
  const data = await res.json();
  const elapsed = Date.now() - start;

  return {
    index,
    status: res.status,
    success: res.status === 201,
    elapsed,
    error: res.status !== 201 ? data?.error?.code ?? data?.message : null,
  };
}

// ─────────────────────────────────────────
// 4. Main
// ─────────────────────────────────────────
async function main() {
  console.log('🚀 Race Condition Test\n');

  const token = await login();
  console.log('✅ Login thành công\n');

  const flashSaleId = await getActiveFlashSaleId();
  console.log(`✅ Flash Sale ID: ${flashSaleId}\n`);

  console.log(`⚡ Gửi ${CONCURRENT} requests đồng thời...\n`);

  // Tạo tất cả promise cùng lúc — không await từng cái
  const promises = Array.from({ length: CONCURRENT }, (_, i) =>
    placeOrder(token, flashSaleId, i + 1),
  );
  const results = await Promise.all(promises);

  // ─────────────────────────────────────────
  // 5. Tổng kết kết quả
  // ─────────────────────────────────────────
  const succeeded = results.filter((r) => r.success);
  const failed    = results.filter((r) => !r.success);

  console.log('─'.repeat(50));
  console.log(`📊 KẾT QUẢ:`);
  console.log(`   Tổng requests : ${CONCURRENT}`);
  console.log(`   Thành công    : ${succeeded.length}`);
  console.log(`   Thất bại      : ${failed.length}`);
  console.log('─'.repeat(50));

  if (succeeded.length > 5) {
    console.log(`\n🔴 OVERSELLING DETECTED!`);
    console.log(`   maxQty = 5, nhưng có ${succeeded.length} orders thành công`);
    console.log(`   → soldQty sẽ = ${succeeded.length} (vượt quá maxQty)\n`);
  } else {
    console.log(`\n🟢 Không thấy overselling lần này (có thể chạy lại)`);
  }

  // In từng kết quả
  console.log('\nChi tiết:');
  results.forEach((r) => {
    const icon = r.success ? '✅' : '❌';
    const err  = r.error ? ` — ${r.error}` : '';
    console.log(`  [${String(r.index).padStart(2)}] ${icon} ${r.status} (${r.elapsed}ms)${err}`);
  });

  // ─────────────────────────────────────────
  // 6. Kiểm tra soldQty thực tế trong DB
  // ─────────────────────────────────────────
  console.log('\n📌 Kiểm tra trạng thái flash sale sau test:');
  const res = await fetch(`${BASE_URL}/flash-sales/${flashSaleId}`);
  const sale = await res.json();
  const { soldQty, maxQty } = sale.data;
  console.log(`   soldQty = ${soldQty} / maxQty = ${maxQty}`);
  if (soldQty > maxQty) {
    console.log(`   🔴 soldQty (${soldQty}) > maxQty (${maxQty}) — overselling confirmed!\n`);
  } else {
    console.log(`   🟢 soldQty trong giới hạn\n`);
  }
}

main().catch(console.error);
