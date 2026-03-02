import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
    constructor(private reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext) {
        // Đọc metadata 'isPublic' từ route handler hoặc class
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(), // check method trước
            context.getClass(), // sau đó check class
        ])

        if (isPublic) {
            // Nếu route được đánh dấu là public, bỏ qua authentication
            return true;
        }

        return super.canActivate(context);
    }
}