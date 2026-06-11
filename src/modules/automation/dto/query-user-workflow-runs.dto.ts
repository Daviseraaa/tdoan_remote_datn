import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowRunStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class QueryUserWorkflowRunsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: WorkflowRunStatus })
  @IsOptional()
  @IsEnum(WorkflowRunStatus)
  status?: WorkflowRunStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workflowId?: string;
}
