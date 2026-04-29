import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;
}

export class ChangePasswordDto {
  @ApiPropertyOptional({ example: 'oldPassword123' })
  @IsString()
  @MinLength(6)
  oldPassword: string = '';

  @ApiPropertyOptional({ example: 'newPassword123' })
  @IsString()
  @MinLength(6)
  newPassword: string = '';
}
