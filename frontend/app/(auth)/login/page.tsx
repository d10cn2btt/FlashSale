'use client';

import { useAuth } from '@/contexts/auth.context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading]);

  const handleSubmit = async () => {
    setError('');
    setIsLoading(true);
    try {
      await login({ email, password });
      // login() dùng flushSync → state đã commit → navigate an toàn
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Đăng nhập thất bại, thử lại sau');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h1>Login</h1>
      {/* e.preventDefault() xử lý inline, handleSubmit chỉ lo business logic */}
      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p>{error}</p>}
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}
