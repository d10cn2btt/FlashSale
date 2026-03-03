'use client';

import { useAuth } from '@/contexts/auth.context';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // useAuth() đọc AuthContext — nếu dùng ngoài AuthProvider sẽ throw lỗi
  // AuthProvider đã wrap toàn app trong layout.tsx → nên luôn an toàn ở đây
  const { isLoading, isAuthenticated } = useAuth();

  // Phải dùng useEffect thay vì if trực tiếp vì:
  // router.push() là side effect — không được gọi trong lúc render
  // useEffect chạy SAU khi render xong → an toàn
  useEffect(() => {
    console.log('isloading', isLoading, 'isAuthenticated', isAuthenticated);
    // Phải check !isLoading trước:
    // Lúc đầu isLoading=true + user=null (đang restore session)
    // Nếu không check → redirect ngay cả khi user đã login → bug
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]); // re-run khi 1 trong 3 biến này thay đổi

  // Đang restore session (F5, lần đầu load) → chờ, không render gì
  // Tránh trường hợp: user đã login nhưng isLoading=true → bị redirect nhầm
  if (isLoading) {
    return null; // TODO: thay bằng <LoadingSpinner /> sau
  }

  // Session đã check xong, không authenticated → return null
  // useEffect đang chạy router.push('/login'), tránh flash nội dung dashboard
  if (!isAuthenticated) {
    return null;
  }

  // Đã authenticated → render nội dung dashboard
  return children;
}
