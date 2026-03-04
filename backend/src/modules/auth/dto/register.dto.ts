import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsString({ message: 'Name phải là chuỗi' })
  @MinLength(1, { message: 'Name không được để trống' })
  name: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  // Ít nhất 8 ký tự, có chữ hoa, chữ thường, số
  @IsString()
  @MinLength(8, { message: 'Password tối thiểu 8 ký tự' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Password phải có ít nhất 1 chữ hoa, 1 chữ thường, 1 số',
  })
  password: string;
}
