import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { TaskType } from '@prisma/client';

export class CreateTaskTemplateDto {
  @ApiProperty({ example: 'Thu thập thông tin hệ thống' })
  @IsString()
  @IsNotEmpty()
  name: string = '';

  @ApiProperty({ enum: TaskType })
  @IsEnum(TaskType)
  type: TaskType = TaskType.COMMAND;

  @ApiProperty()
  @IsUUID()
  agentId: string = '';

  @ApiProperty({ example: 'systeminfo' })
  @IsString()
  @IsNotEmpty()
  command: string = '';

  @ApiPropertyOptional()
  @IsOptional()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ default: 300000 })
  @IsOptional()
  @IsNumber()
  @Min(5000)
  timeout?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  priority?: number;
}
