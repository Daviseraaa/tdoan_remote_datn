import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { TaskStatus, TaskType } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryTaskDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Tìm theo ID, lệnh, kết quả hoặc tên agent' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TaskType })
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  agentId?: string;
}
