import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateTelegramBotDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** Chat ID được phép, phân tách dấu phẩy — để trống = mọi chat */
  @ApiPropertyOptional({ example: '-1001234567890, 123456789' })
  @IsOptional()
  @IsString()
  allowedChatIds?: string;

  /** User ID Telegram được phép, phân tách dấu phẩy — để trống = mọi user */
  @ApiPropertyOptional({ example: '123456789, 987654321' })
  @IsOptional()
  @IsString()
  allowedUserIds?: string;
}
