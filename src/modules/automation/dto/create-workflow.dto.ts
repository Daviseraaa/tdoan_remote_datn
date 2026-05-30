import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OnFailure, StepType } from '@prisma/client';

/** JSON config lưu Prisma — whitelist từng field để qua ValidationPipe forbidNonWhitelisted */
export class WorkflowStepConfigDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  command?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taskType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  delayMs?: number;

  @ApiPropertyOptional({
    description: 'Chờ thêm (ms) sau bước này — ghi đè stepDelayMs workflow',
  })
  @IsOptional()
  @IsNumber()
  delayAfterMs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  timeout?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: { x: 0, y: 0 } })
  @IsOptional()
  @IsObject()
  ui?: { x: number; y: number };

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Legacy — không lưu mới' })
  @IsOptional()
  @Allow()
  graphEdges?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({
    description: 'Định danh ổn định node ( = node.id canvas)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsString()
  stepKey?: string;

  @ApiPropertyOptional({ example: 'last_exit_success' })
  @IsOptional()
  @IsString()
  conditionMode?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  conditionExitCode?: number;

  @ApiPropertyOptional({
    description: 'Thứ tự ổn định — không đổi khi sắp xếp BFS',
  })
  @IsOptional()
  @IsNumber()
  stepOrder?: number;

  @ApiPropertyOptional({ description: 'Telegram action step' })
  @IsOptional()
  @Allow()
  action?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  botToken?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  telegramBotId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  chatId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  photoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  documentUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  inlineKeyboard?: unknown;

  @ApiPropertyOptional({
    description: 'Key để tham chiếu output trong {{steps.<key>.stdout}}',
    example: 'sysinfo',
  })
  @IsOptional()
  @IsString()
  outputKey?: string;
}

export class WorkflowStepDto {
  @ApiPropertyOptional({ description: 'Existing step id (update only)' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  order: number = 0;

  @ApiProperty({ enum: StepType, example: 'COMMAND' })
  @IsEnum(StepType)
  type: StepType = StepType.COMMAND;

  @ApiProperty({
    type: WorkflowStepConfigDto,
    example: { command: 'ipconfig', agentId: 'uuid-here' },
  })
  @ValidateNested()
  @Type(() => WorkflowStepConfigDto)
  config: WorkflowStepConfigDto = new WorkflowStepConfigDto();

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

  @ApiPropertyOptional({
    description: 'Chờ (ms) sau mỗi bước trước khi chạy bước kế tiếp trên nhánh',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  stepDelayMs?: number;

  @ApiPropertyOptional({
    description: 'Biến tĩnh workflow — dùng {{workflow.<key>}} trong command/payload',
    example: { API_URL: 'https://api.example.com' },
  })
  @IsOptional()
  @Allow()
  variables?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Graph v2: { version: 2, edges: [{ from, to, handle? }] }',
  })
  @IsOptional()
  @Allow()
  graph?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Legacy graphEdges — chỉ đọc, không ghi mới',
  })
  @IsOptional()
  @Allow()
  graphEdges?: Array<Record<string, unknown>>;

  @ApiProperty({ type: [WorkflowStepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowStepDto)
  steps: WorkflowStepDto[] = [];
}
