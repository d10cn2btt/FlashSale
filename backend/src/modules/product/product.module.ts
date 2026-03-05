import { Module } from "@nestjs/common";
import { ProductController } from "./product.controller";
import { ProductService } from "./product.service";

@Module({
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService], // export để FlashSaleModule dùng sau
})
export class ProductModule {}