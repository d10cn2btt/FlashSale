import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  // Login không cần check độ mạnh — chỉ cần là string để đem đi bcrypt.compare()
  @IsString()
  password: string;
}
