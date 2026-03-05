import { IsInt, IsNumber, IsOptional, IsPositive, IsString, Min, MinLength } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1, { message: 'Tên sản phẩm không được để trống' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Giá sản phẩm phải là số và có tối đa 2 chữ số thập phân' })
  @IsPositive({ message: 'Giá sản phẩm phải là số dương' })
  price: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsInt({ message: 'Số lượng sản phẩm phải là số nguyên' })
  @Min(0, { message: 'Số lượng sản phẩm phải lớn hơn hoặc bằng 0' })
  quantity: number;
}