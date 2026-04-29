import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OnFailure, StepType } from '@prisma/client';

export class WorkflowStepDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  order: number = 0;

  @ApiProperty({ enum: StepType, example: 'COMMAND' })
  @IsEnum(StepType)
  type: StepType = StepType.COMMAND;

  @ApiProperty({
    example: { command: 'ipconfig', agentId: 'uuid-here' },
    description: 'Step configuration (command, params, etc.)',
  })
  config: Record<string, unknown> = {};

  @ApiPropertyOptional({ enum: OnFailure, default: 'STOP' })
  @IsOptional()
  @IsEnum(OnFailure)
  onFailure?: OnFailure;
}

export class CreateWorkflowDto {
  @ApiProperty({ example: 'Daily System Check' })
  @IsString()
  @IsNotEmpty()
  name: string = '';

  @ApiPropertyOptional({ example: 'Runs system diagnostics every morning' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '0 8 * * *', description: 'Cron expression for scheduling' })
  @IsOptional()
  @IsString()
  cronExpression?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({ type: [WorkflowStepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps: WorkflowStepDto[] = [];
}
