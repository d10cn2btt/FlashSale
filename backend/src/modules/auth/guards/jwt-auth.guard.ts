import {
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RedisService } from 'src/common/redis/redis.service';
import { AuthErrors } from 'src/common/errors/auth.errors';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private readonly redisService: RedisService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    // Đọc metadata 'isPublic' từ route handler hoặc class
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // check method trước
      context.getClass(), // sau đó check class
    ]);

    if (isPublic) {
      // Nếu route được đánh dấu là public, bỏ qua authentication
      return true;
    }

    await super.canActivate(context);
    const { user } = context.switchToHttp().getRequest();

    // Nếu jti tồn tại, kiểm tra xem nó có bị blacklist không
    await this.checkBlacklist(user?.jti);
    // Nếu đến đây nghĩa là JWT hợp lệ, canActivate của AuthGuard đã gắn user vào request
    // Chỉ cần return true để cho phép tiếp tục xử lý request

    return true;
  }

  private async checkBlacklist(jti: string) {
    let isBlacklisted: string | null;
    try {
      // Kiểm tra Redis xem jti có bị blacklist không
      isBlacklisted = await this.redisService.getBlacklistToken(jti);
    } catch {
      throw AuthErrors.serviceUnavailable();
    }

    if (isBlacklisted) {
      throw AuthErrors.tokenRevoked();
    }
  }
}
