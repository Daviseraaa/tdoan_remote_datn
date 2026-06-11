import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class WriteAgentFileDto {
  @ApiProperty({ example: 'stationhub/workspace/deploy.ps1' })
  @IsString()
  @MinLength(1)
  path!: string;

  @ApiProperty({ description: 'Nội dung file (utf-8 hoặc base64)' })
  @IsString()
  content!: string;

  @ApiPropertyOptional({ enum: ['utf-8', 'base64'], default: 'utf-8' })
  @IsOptional()
  @IsString()
  encoding?: string;

  @ApiPropertyOptional({ description: 'ID upload chunked — giữ nguyên qua các chunk' })
  @IsOptional()
  @IsString()
  uploadId?: string;

  @ApiPropertyOptional({ description: 'Chỉ số chunk (0-based)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  chunkIndex?: number;

  @ApiPropertyOptional({ description: 'Tổng số chunk' })
  @IsOptional()
  @IsInt()
  @Min(1)
  totalChunks?: number;
}
