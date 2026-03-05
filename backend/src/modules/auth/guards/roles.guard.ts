import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { Role } from "generated/prisma/enums";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const user = context.switchToHttp().getRequest().user;

    if (!requiredRoles) {
      // Nếu route không có metadata 'roles', cho phép truy cập
      return true;
    }

    // Kiểm tra xem user có role nào trong requiredRoles không
    if (!requiredRoles.includes(user?.role)) {
      throw new ForbiddenException({
        error: { code: 'FORBIDDEN', message: 'You do not have permission' },
      }); // Nếu không có, từ chối truy cập
    }

    return true;
  }
}