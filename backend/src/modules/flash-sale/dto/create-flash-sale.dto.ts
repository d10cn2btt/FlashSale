import { IsDateString, IsInt, IsNumber, IsPositive, IsUUID, Min } from 'class-validator';

export class CreateFlashSaleDto {
  @IsUUID('4', { message: 'productId phải là UUID hợp lệ' })
  productId: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'discountPrice phải là số, tối đa 2 chữ số thập phân' })
  @IsPositive({ message: 'discountPrice phải lớn hơn 0' })
  discountPrice: number;

  @IsInt({ message: 'maxQty phải là số nguyên' })
  @Min(1, { message: 'maxQty phải ít nhất là 1' })
  maxQty: number;

  @IsDateString({}, { message: 'startAt phải là ISO date string' })
  startAt: string;

  @IsDateString({}, { message: 'endAt phải là ISO date string' })
  endAt: string;
}
