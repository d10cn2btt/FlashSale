'use client';

import { useAuth } from '@/contexts/auth.context';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm">
        <p className="text-lg font-semibold text-gray-900">Xin chào, {user?.name}!</p>
        <div className="mt-3 flex flex-col gap-1 text-sm text-gray-600">
          <p>Email: {user?.email}</p>
          <p>Role: {user?.role}</p>
        </div>
      </div>
    </div>
  );
}
