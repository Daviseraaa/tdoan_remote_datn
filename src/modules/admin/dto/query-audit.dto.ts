import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryAuditDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'Filter by resource type (e.g. auth, user, agent)' })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated resource types (e.g. user,agent)',
  })
  @IsOptional()
  @IsString()
  resourceIn?: string;

  @ApiPropertyOptional({ description: 'ISO date — inclusive start' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date — inclusive end' })
  @IsOptional()
  @IsString()
  to?: string;
}
