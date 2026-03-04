import axios from 'axios';

// 1. AccessToken lưu trong memory (biến module-level, không export)
let accessToken: string | null = null;

// setter/getter để AuthContext có thể set token sau login
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true, // bắt buộc để gửi httpOnly cookie (refresh token)
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];
const notifySubscribers = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    // _skipRefresh: dùng cho restoreSession — 401 ở đây nghĩa là "chưa login", không cần refresh
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest._skipRefresh) {
      if (isRefreshing) {
        // Đang refresh rồi → cho vào queue, chờ token mới
        return new Promise((resolve) => {
          refreshSubscribers.push((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      // bắt đầu refresh
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const responseRefresh = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          {},
          { withCredentials: true }, // ← bắt buộc để gửi httpOnly cookie
        );
        const newToken = responseRefresh.data.data.accessToken;

        setAccessToken(newToken);
        notifySubscribers(newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;

        return apiClient(originalRequest);
      } catch {
        setAccessToken(null);
        // Chỉ redirect nếu không phải đang ở /login hoặc /register (tránh vòng lặp vô tận)
        const publicPaths = ['/login', '/register'];
        if (typeof window !== 'undefined' && !publicPaths.includes(window.location.pathname)) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    const message = extractErrorMessage(error.response?.data);
    if (message) {
      error.message = message;
    }

    return Promise.reject(error);
  },
);

function extractErrorMessage(data: any): string | null {
  if (!data) return null;

  // Format 1: Custom error { error: { message } }
  if (typeof data.error?.message === 'string') {
    return data.error.message;
  }

  // Format 2: ValidationPipe { message: string[] }
  if (Array.isArray(data.message) && data.message.length > 0) {
    return data.message[0]; // lấy lỗi đầu tiên
  }

  return null;
}
