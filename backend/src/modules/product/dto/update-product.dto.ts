import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

// PartialType tự động làm tất cả fields của CreateProductDto thành optional
// và kế thừa toàn bộ validators — không cần viết lại
export class UpdateProductDto extends PartialType(CreateProductDto) {}