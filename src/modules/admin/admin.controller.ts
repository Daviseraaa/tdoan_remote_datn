import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
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
import { CreateUserDto, UpdateUserDto } from './dto/admin-user.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { QueryAgentsAdminDto } from './dto/query-agents.dto';
import { QueryAuditDto } from './dto/query-audit.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly audit: AuditService,
    private readonly tasks: TasksService,
  ) {}

  @Get('stats')
  @ApiOperation({ summary: 'Dashboard stats' })
  stats() {
    return this.admin.getStats();
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

  @Get('tasks')
  @ApiOperation({ summary: 'List all tasks (Admin)' })
  listTasks(@Query() query: QueryTasksDto) {
    this.admin.validateFilters(query);
    return this.admin.listTasks(query);
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
