import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class UserService {
    constructor(private readonly prisma: PrismaService) {}

    findAll() {
        return this.prisma.user.findMany({
            where: { deletedAt: null },
        });
    }

    findOne(id: string) {
        return this.prisma.user.findFirst({
            where: { id, deletedAt: null },
        });
    }
}
