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

export class CreateTaskDto {
  @ApiProperty({ enum: TaskType, example: 'COMMAND' })
  @IsEnum(TaskType)
  type: TaskType = TaskType.COMMAND;

  @ApiProperty({ example: 'ipconfig /all' })
  @IsString()
  @IsNotEmpty()
  command: string = '';

  @ApiProperty({ description: 'Target agent ID' })
  @IsUUID()
  agentId: string = '';

  @ApiPropertyOptional({ description: 'Additional payload as JSON' })
  @IsOptional()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  priority?: number;

  @ApiPropertyOptional({ description: 'Timeout in milliseconds', default: 300000 })
  @IsOptional()
  @IsNumber()
  @Min(5000)
  timeout?: number;
}
