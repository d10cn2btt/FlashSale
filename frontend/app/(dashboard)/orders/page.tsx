'use client';

import { useEffect, useState } from 'react';
import { orderApi } from '@/lib/api/order';

type Order = {
  id: string;
  qty: number;
  totalPrice: number;
  createdAt: string;
  flashSale: {
    discountPrice: number;
    product: { name: string };
  };
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orderApi
      .getMyOrders()
      .then((data) => setOrders(data.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-8 text-gray-700">Đang tải...</p>;

  if (orders.length === 0)
    return <p className="p-8 text-gray-600">Bạn chưa có đơn hàng nào.</p>;

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Đơn hàng của tôi</h1>
      <div className="flex flex-col gap-3">
        {orders.map((order) => (
          <div key={order.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-900">{order.flashSale.product.name}</span>
              <span className="font-bold text-red-500">
                {order.totalPrice.toLocaleString()}đ
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Số lượng: {order.qty} &nbsp;·&nbsp;{' '}
              {new Date(order.createdAt).toLocaleString('vi-VN')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}