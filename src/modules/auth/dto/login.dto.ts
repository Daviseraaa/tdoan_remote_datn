import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@datn.com' })
  @IsEmail()
  email: string = '';

  @ApiProperty({ example: 'admin123' })
  @IsString()
  @IsNotEmpty()
  password: string = '';
}
