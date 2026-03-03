// User object trả về từ API
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

// Response from login / register API (theo convention: { data: T })
export interface AuthResponse {
  data: {
    user: AuthUser;
    accessToken: string;
  }
}

// Body gửi lên khi đăng nhập
export interface LoginPayload {
  email: string;
  password: string;
}

// Body gửi lên khi đăng ký
export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

// State của AuthContext (dùng ở Step 3)
export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}
