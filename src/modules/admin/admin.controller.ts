import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import {
  CurrentUser,
  JwtPayload,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { AuditService } from './audit.service';
import { TasksService } from '../tasks/tasks.service';
import { AgentsGateway } from '../agents/agents.gateway';
import { AgentsService } from '../agents/agents.service';
import {
  UpdateRemoteAccessDto,
  WakeAgentDto,
} from '../agents/dto/index';
import { CreateUserDto, UpdateUserDto } from './dto/admin-user.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { QueryAgentsAdminDto } from './dto/query-agents.dto';
import { QueryAuditDto } from './dto/query-audit.dto';
import { QueryWorkflowRunsDto } from './dto/query-workflow-runs.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { CreateAdminPlanDto, UpdateAdminPlanDto } from './dto/admin-plan.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import {
  CreateTaskTemplateDto,
  UpdateTaskTemplateDto,
} from '../tasks/dto/index';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly audit: AuditService,
    private readonly tasks: TasksService,
    private readonly agents: AgentsService,
    private readonly agentsGateway: AgentsGateway,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard stats' })
  stats() {
    return this.admin.getStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  listUsers(@Query() pagination: PaginationDto) {
    return this.admin.listUsers(pagination);
  }

  @Get('plans')
  @ApiOperation({ summary: 'List subscription plans' })
  listPlans() {
    return this.admin.listPlans();
  }

  @Post('plans')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create subscription plan' })
  createPlan(@Body() dto: CreateAdminPlanDto) {
    return this.admin.createPlan(dto);
  }

  @Patch('plans/:id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Update subscription plan' })
  updatePlan(@Param('id') id: string, @Body() dto: UpdateAdminPlanDto) {
    return this.admin.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Delete subscription plan' })
  deletePlan(@Param('id') id: string) {
    return this.admin.deletePlan(id);
  }

  @Get('workflow-runs')
  @ApiOperation({ summary: 'Workflow runs — user, flow, trigger channel' })
  listWorkflowRuns(@Query() query: QueryWorkflowRunsDto) {
    return this.admin.listWorkflowRuns(query);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Subscription payment history (all users)' })
  listPayments(@Query() query: QueryPaymentsDto) {
    return this.admin.listPayments(query);
  }

  @Post('users')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create user (Admin)' })
  async createUser(
    @CurrentUser() actor: JwtPayload,
    @Body() dto: CreateUserDto,
    @Ip() ip: string,
  ) {
    const user = await this.admin.createUser(dto);
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'user.create',
      resource: 'user',
      resourceId: user.id,
      metadata: { email: user.email, role: user.role },
      ip,
    });
    return user;
  }

  @Patch('users/:id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Update user (Admin)' })
  async updateUser(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Ip() ip: string,
  ) {
    const user = await this.admin.updateUser(id, dto);
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'user.update',
      resource: 'user',
      resourceId: user.id,
      metadata: { fields: Object.keys(dto) },
      ip,
    });
    return user;
  }

  @Get('agents')
  @ApiOperation({ summary: 'List all agents (Admin)' })
  listAgents(@Query() query: QueryAgentsAdminDto) {
    return this.admin.listAgents(query, query.status);
  }

  @Get('agents/:id/files')
  @ApiOperation({ summary: 'Liệt kê file StationHub trên agent (Admin)' })
  listAgentFiles(@Param('id') id: string, @Query('path') path?: string) {
    return this.agentsGateway.listAgentFiles(id, null, path ?? '');
  }

  @Post('agents/:id/files/write')
  @ApiOperation({ summary: 'Ghi file lên agent (Admin)' })
  writeAgentFile(
    @Param('id') id: string,
    @Body() body: import('../agents/dto/write-agent-file.dto').WriteAgentFileDto,
  ) {
    return this.agentsGateway.writeAgentFile(id, null, body);
  }

  @Get('agents/:id/files/download')
  @ApiOperation({ summary: 'Tải file từ agent (Admin)' })
  @Header('Cache-Control', 'no-store')
  async downloadAgentFile(
    @Param('id') id: string,
    @Query('path') path: string,
    @Res() res: Response,
  ) {
    const file = await this.agentsGateway.readAgentFile(id, null, path);
    const name = file.path.split('/').pop() || 'download';
    const buf =
      file.encoding === 'base64'
        ? Buffer.from(file.content, 'base64')
        : Buffer.from(file.content, 'utf-8');
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(name)}"`,
    );
    res.send(buf);
  }

  @Get('agents/:id')
  @ApiOperation({ summary: 'Get agent by id (Admin)' })
  getAgent(@Param('id') id: string) {
    return this.admin.getAgentById(id);
  }

  @Delete('agents/:id')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Delete agent (Admin)' })
  async deleteAgent(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    const res = await this.admin.deleteAgent(id);
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'agent.delete',
      resource: 'agent',
      resourceId: id,
      ip,
    });
    return res;
  }

  @Post('agents/:id/regenerate-key')
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @ApiOperation({ summary: 'Regenerate agent key (Admin)' })
  async regenerateKey(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    const agent = await this.admin.regenerateAgentKey(id);
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'agent.regenerate_key',
      resource: 'agent',
      resourceId: id,
      ip,
    });
    return agent;
  }

  @Post('agents/:id/wake')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Wake agent machine via Wake-on-LAN (Admin)' })
  async wakeAgent(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: WakeAgentDto,
    @Ip() ip: string,
  ) {
    const res = await this.agents.wakeAgent(id, null, dto);
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'agent.wake',
      resource: 'agent',
      resourceId: id,
      metadata: { macAddress: res.macAddress, broadcast: res.broadcast },
      ip,
    });
    return res;
  }

  @Patch('agents/:id/remote-access')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cấu hình MAC WoL / RDP (Admin)' })
  async updateAgentRemoteAccess(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRemoteAccessDto,
    @Ip() ip: string,
  ) {
    const agent = await this.agents.updateRemoteAccess(id, null, dto);
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'agent.remote_access.update',
      resource: 'agent',
      resourceId: id,
      metadata: { fields: Object.keys(dto) },
      ip,
    });
    return agent;
  }

  @Post('agents/:id/remote/start')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Khởi động remote trên agent (Admin)' })
  async startAgentRemote(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    const res = await this.agentsGateway.startAgentRemote(id, null);
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'agent.remote.start',
      resource: 'agent',
      resourceId: id,
      metadata: { provider: res.provider },
      ip,
    });
    return res;
  }

  @Post('agents/:id/remote/stop')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Dừng remote trên agent (Admin)' })
  async stopAgentRemote(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    const res = await this.agentsGateway.stopAgentRemote(id, null);
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'agent.remote.stop',
      resource: 'agent',
      resourceId: id,
      metadata: { provider: res.provider },
      ip,
    });
    return res;
  }

  @Get('tasks')
  @ApiOperation({ summary: 'List all tasks (Admin)' })
  listTasks(@Query() query: QueryTasksDto) {
    this.admin.validateFilters(query);
    return this.admin.listTasks(query);
  }

  @Get('tasks/templates')
  @ApiOperation({ summary: 'List all task templates (Admin)' })
  listTaskTemplates(@Query() query: PaginationDto) {
    return this.tasks.findAllTemplatesAdmin(query);
  }

  @Post('tasks/templates')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create task template as current admin user' })
  createTaskTemplate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTaskTemplateDto,
  ) {
    return this.tasks.createTemplate(user.sub, dto);
  }

  @Get('tasks/templates/:id')
  @ApiOperation({ summary: 'Get task template by id (Admin)' })
  getTaskTemplate(@Param('id') id: string) {
    return this.tasks.getTemplateOrThrow(id, '', true);
  }

  @Patch('tasks/templates/:id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Update task template (Admin)' })
  updateTaskTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateTaskTemplateDto,
  ) {
    return this.tasks.updateTemplate(id, '', true, dto);
  }

  @Delete('tasks/templates/:id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Delete task template (Admin)' })
  deleteTaskTemplate(@Param('id') id: string) {
    return this.tasks.deleteTemplate(id, '', true);
  }

  @Post('tasks/templates/:id/run')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Run task from template (Admin, uses template owner context)' })
  runTaskTemplate(@Param('id') id: string) {
    return this.tasks.runTemplate(id, '', true);
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: 'Task detail (Admin)' })
  getTask(@Param('id') id: string) {
    return this.admin.getTask(id);
  }

  @Delete('tasks/:id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cancel task (Admin)' })
  async cancelTask(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    const res = await this.admin.cancelTask(id);
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'task.cancel',
      resource: 'task',
      resourceId: id,
      ip,
    });
    return res;
  }

  @Post('tasks/:id/retry')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Re-run a finished task (Admin)' })
  async retryTask(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    const res = await this.tasks.retry(id);
    await this.audit.record({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: 'task.retry',
      resource: 'task',
      resourceId: id,
      ip,
    });
    return res;
  }

  @Get('workflows')
  @ApiOperation({ summary: 'List all workflows (Admin)' })
  listWorkflows(@Query() pagination: PaginationDto) {
    return this.admin.listWorkflows(pagination);
  }

  @Get('audit-logs')
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @ApiOperation({ summary: 'Admin audit log' })
  listAudit(@Query() query: QueryAuditDto) {
    return this.audit.list({
      page: query.page,
      limit: query.limit,
      actor: query.actor,
      action: query.action,
    });
  }
}
