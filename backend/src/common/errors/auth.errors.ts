import { ConflictException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';

// Error Factory — tập trung error codes + messages của Auth module vào 1 chỗ
// Khi cần đổi message/code → chỉ sửa ở đây, không cần tìm khắp codebase
export const AuthErrors = {
  emailTaken: () => new ConflictException({ error: { code: 'EMAIL_TAKEN', message: 'Email đã được sử dụng' } }),
  invalidCredentials: () => new UnauthorizedException({ error: { code: 'INVALID_CREDENTIALS', message: 'Email hoặc mật khẩu không đúng' } }),
  invalidToken: () => new UnauthorizedException({ error: { code: 'INVALID_TOKEN', message: 'Refresh token không hợp lệ' } }),
  tokenRevoked: () => new UnauthorizedException({ error: { code: 'TOKEN_REVOKED', message: 'Token đã bị thu hồi, vui lòng thử lại' } }),
  tokenReuseDetected: () => new UnauthorizedException({ error: { code: 'TOKEN_REUSE_DETECTED', message: 'Phát hiện token bị đánh cắp, toàn bộ session đã bị thu hồi' } }),
  serviceUnavailable: () => new ServiceUnavailableException({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Auth service tạm thời không khả dụng' } }),
};
