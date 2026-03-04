'use client';

import { apiClient, setAccessToken } from '@/lib/api/client';
import { AuthUser, LoginPayload, RegisterPayload } from '@/types/auth.types';
import { createContext, useContext, useEffect, useState } from 'react';

// ---------- 1. Định nghĩa shape của Context ----------
interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
}

// ---------- 2. Tạo Context (default undefined) ----------
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------- 3. Provider ----------
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true vì đang check session

  // khi app load lần đầu -> check session hiện tại
  useEffect(() => {
    const restoreSession = async () => {
      try {
        // Không dùng _skipRefresh ở đây:
        // F5 → accessToken bị clear → /auth/me trả 401
        // → interceptor tự gọi /auth/refresh bằng httpOnly cookie
        // → nếu còn hợp lệ: nhận access token mới → retry /auth/me thành công
        // → nếu hết hạn: refresh fail → catch bên dưới → user = null
        const response = await apiClient.get('/auth/me');
        setUser(response.data.data.user);
      } catch {
        // 401 không phải lỗi - chỉ là chưa đăng nhập
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    restoreSession();
  }, []);

  const login = async (payload: LoginPayload) => {
    // setIsLoading(true) → dashboard layout thấy isLoading=true → return null (chờ)
    // tránh race condition: dashboard mount → isAuthenticated=false → redirect /login
    setIsLoading(true);
    try {
      const loginRes = await apiClient.post('/auth/login', payload);
      setAccessToken(loginRes.data.data.accessToken);

      // Gọi /auth/me để lấy user — nhất quán với restoreSession
      // accessToken đã set ở trên → interceptor tự gắn Bearer
      const meRes = await apiClient.get('/auth/me');
      setUser(meRes.data.data.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await apiClient.post('/auth/logout');
    setAccessToken(null);
    setUser(null);
  };

  const register = async (payload: RegisterPayload) => {
    await apiClient.post('/auth/register', payload);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user, // convert boolean
        login,
        logout,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------- 4. Custom hook ----------
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
