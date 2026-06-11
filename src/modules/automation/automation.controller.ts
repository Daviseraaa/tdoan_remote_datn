import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { AutomationService } from './automation.service';
import { WorkflowRuntimeService } from './workflow-runtime.service';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/index';
import { QueryUserWorkflowRunsDto } from './dto/query-user-workflow-runs.dto';

@ApiTags('Automation / Workflows')
@ApiBearerAuth()
@Controller('workflows')
export class AutomationController {
  constructor(
    private readonly automationService: AutomationService,
    private readonly workflowRuntime: WorkflowRuntimeService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workflow' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateWorkflowDto) {
    return this.automationService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List workflows' })
  findAll(@CurrentUser() user: JwtPayload, @Query() pagination: PaginationDto) {
    return this.automationService.findAll(user.sub, pagination);
  }

  @Get('runs')
  @ApiOperation({ summary: 'List workflow run history for current user' })
  listRuns(
    @CurrentUser() user: JwtPayload,
    @Query() query: QueryUserWorkflowRunsDto,
  ) {
    return this.workflowRuntime.listRuns(user.sub, query);
  }

  @Get('runs/:runId')
  @ApiOperation({ summary: 'Get workflow run status and step runs' })
  getRun(@CurrentUser() user: JwtPayload, @Param('runId') runId: string) {
    return this.workflowRuntime.getRun(runId, user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow details' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.automationService.findOne(id, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a workflow' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.automationService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workflow' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.automationService.remove(id, user.sub);
  }

  @Post(':id/execute')
  @ApiOperation({
    summary: 'Execute a workflow (async by default; ?wait=true for sync)',
  })
  async execute(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('wait') wait: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    const sync = wait === 'true' || wait === '1';
    const result = await this.automationService.execute(id, user.sub, sync);
    if (!sync) {
      res.status(HttpStatus.ACCEPTED);
    }
    return result;
  }
}
