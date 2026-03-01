import { Controller, Get, Param } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Get()
    async findAll() {
        const data = await this.userService.findAll();
        return { data };
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const data = await this.userService.findOne(id);
        return { data };
    }
}
