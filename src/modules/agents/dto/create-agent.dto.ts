import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAgentDto {
  @ApiProperty({ example: 'My Work PC' })
  @IsString()
  @IsNotEmpty()
  name: string = '';

  @ApiPropertyOptional({ example: 'Windows 11' })
  @IsOptional()
  @IsString()
  os?: string;

  @ApiPropertyOptional({ example: 'DESKTOP-ABC123' })
  @IsOptional()
  @IsString()
  hostname?: string;
}
