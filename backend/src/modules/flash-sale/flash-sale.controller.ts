import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { FlashSaleService } from './flash-sale.service';
import { CreateFlashSaleDto } from './dto/create-flash-sale.dto';
import { Public } from 'src/modules/auth/decorators/public.decorator';
import { Roles } from 'src/modules/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { Role } from 'generated/prisma/enums';

@UseGuards(RolesGuard)
@Controller('flash-sales')
export class FlashSaleController {
  constructor(private readonly flashSaleService: FlashSaleService) {}

  @Public()
  @Get('active')
  findActive() {
    return this.flashSaleService.findActive();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.flashSaleService.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(@Body() dto: CreateFlashSaleDto) {
    return this.flashSaleService.create(dto);
  }
}
