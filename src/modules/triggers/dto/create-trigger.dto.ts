import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ScheduleKind, WorkflowTriggerType } from '@prisma/client';

export class CreateWorkflowTriggerDto {
  @ApiProperty({ enum: WorkflowTriggerType })
  @IsEnum(WorkflowTriggerType)
  type!: WorkflowTriggerType;

  @ApiProperty()
  @IsUUID()
  workflowId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ default: 'Asia/Ho_Chi_Minh' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ enum: ScheduleKind })
  @IsOptional()
  @IsEnum(ScheduleKind)
  scheduleKind?: ScheduleKind;

  @ApiPropertyOptional({ example: '0 8 * * *' })
  @IsOptional()
  @IsString()
  cronExpression?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(60)
  intervalSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  runAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  dailyHour?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  dailyMinute?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  telegramBotId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  matchConfig?: Record<string, unknown>;
}

export class CreateTelegramBotDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  botToken!: string;
}
