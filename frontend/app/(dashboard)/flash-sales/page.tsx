'use client';

import { useEffect, useState } from 'react';
import { flashSaleApi } from '@/lib/api/flash-sale';
import { orderApi } from '@/lib/api/order';

type FlashSale = {
  id: string;
  discountPrice: number;
  maxQty: number;
  soldQty: number;
  endAt: string;
  product: { name: string; price: number };
};

export default function FlashSalesPage() {
  const [flashSales, setFlashSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  useEffect(() => {
    flashSaleApi
      .getActive()
      .then((data) => setFlashSales(data.data))
      .finally(() => setLoading(false));
  }, []);

  async function handleBuy(flashSaleId: string) {
    setBuying(flashSaleId);
    setMessage(null);
    try {
      await orderApi.create(flashSaleId);
      setMessage({ id: flashSaleId, text: 'Đặt hàng thành công!', ok: true });
      // Cập nhật soldQty local — không cần fetch lại cả list
      setFlashSales((prev) =>
        prev.map((s) => s.id === flashSaleId ? { ...s, soldQty: s.soldQty + 1 } : s),
      );
    } catch (err: any) {
      setMessage({ id: flashSaleId, text: err.message ?? 'Đã có lỗi xảy ra', ok: false });
    } finally {
      setBuying(null);
    }
  }

  if (loading) return <p className="p-8 text-gray-700">Đang tải...</p>;

  if (flashSales.length === 0)
    return <p className="p-8 text-gray-600">Không có flash sale nào đang diễn ra.</p>;

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Flash Sales</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {flashSales.map((sale) => {
          const remaining = sale.maxQty - sale.soldQty;
          const isSoldOut = remaining <= 0;
          const isBuying = buying === sale.id;
          const msg = message?.id === sale.id ? message : null;

          return (
            <div key={sale.id} className="rounded-lg border p-4 shadow-sm">
              <h2 className="font-semibold text-gray-900">{sale.product.name}</h2>

              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-xl font-bold text-red-500">
                  {sale.discountPrice.toLocaleString()}đ
                </span>
                <span className="text-sm text-gray-500 line-through">
                  {sale.product.price.toLocaleString()}đ
                </span>
              </div>

              <p className="mt-1 text-sm text-gray-700">
                Còn lại: {remaining}/{sale.maxQty}
              </p>

              {msg && (
                <p className={`mt-2 text-sm ${msg.ok ? 'text-green-600' : 'text-red-500'}`}>
                  {msg.text}
                </p>
              )}

              <button
                onClick={() => handleBuy(sale.id)}
                disabled={isSoldOut || isBuying}
                className="mt-3 w-full rounded bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSoldOut ? 'Hết hàng' : isBuying ? 'Đang xử lý...' : 'Mua ngay'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}