import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class WakeAgentDto {
  @ApiPropertyOptional({
    example: 'AA:BB:CC:DD:EE:FF',
    description: 'Ghi đè MAC (mặc định lấy từ agent metadata)',
  })
  @IsOptional()
  @IsString()
  macAddress?: string;

  @ApiPropertyOptional({
    example: '192.168.1.255',
    description: 'Broadcast subnet (mặc định metadata hoặc WOL_DEFAULT_BROADCAST)',
  })
  @IsOptional()
  @IsString()
  broadcast?: string;

  @ApiPropertyOptional({ example: 9, description: 'UDP port magic packet (mặc định 9)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;
}
