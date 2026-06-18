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
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { AuditService } from '../admin/audit.service';
import { AgentsGateway } from './agents.gateway';
import { AgentsService } from './agents.service';
import {
  CreateAgentDto,
  QueryAgentDto,
  UpdateRemoteAccessDto,
  WakeAgentDto,
  WriteAgentFileDto,
} from './dto/index';

@ApiTags('Agents')
@ApiBearerAuth()
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly agentsGateway: AgentsGateway,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Register a new agent' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAgentDto,
    @Ip() ip: string,
  ) {
    const agent = await this.agentsService.create(user.sub, dto);
    await this.audit.record({
      actorId: user.sub,
      actorEmail: user.email,
      action: 'agent.create',
      resource: 'agent',
      resourceId: agent.id,
      metadata: { name: agent.name },
      ip,
    });
    return agent;
  }

  @Get()
  @ApiOperation({ summary: 'List all agents for current user' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryAgentDto) {
    return this.agentsService.findAll(user.sub, query);
  }

  @Post(':id/regenerate-key')
  @ApiOperation({
    summary: 'Regenerate agent key (owner)',
    description:
      'Generates a new agentKey. Existing agent process must update .env and reconnect.',
  })
  regenerateKey(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.agentsService.regenerateKey(id, user.sub);
  }

  @Get(':id/files')
  @ApiOperation({ summary: 'Liệt kê file trong thư mục StationHub trên agent' })
  listFiles(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('path') path?: string,
  ) {
    return this.agentsGateway.listAgentFiles(id, user.sub, path ?? '');
  }

  @Post(':id/files/write')
  @ApiOperation({ summary: 'Ghi file lên agent (thư mục đang duyệt)' })
  writeFile(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: WriteAgentFileDto,
  ) {
    return this.agentsGateway.writeAgentFile(id, user.sub, body);
  }

  @Get(':id/files/download')
  @ApiOperation({ summary: 'Tải file từ agent (sandbox StationHub)' })
  @Header('Cache-Control', 'no-store')
  async downloadFile(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query('path') path: string,
    @Res() res: Response,
  ) {
    const file = await this.agentsGateway.readAgentFile(id, user.sub, path);
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

  @Get(':id')
  @ApiOperation({ summary: 'Get agent details' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.agentsService.findOne(id, user.sub);
  }

  @Post(':id/chrome-profiles/sync')
  @ApiOperation({
    summary: 'Fetch Chrome profiles from agent machine and save to DB',
  })
  syncChromeProfiles(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.agentsGateway.syncChromeProfiles(id, user.sub);
  }

  @Post(':id/wake')
  @ApiOperation({
    summary: 'Wake agent machine via Wake-on-LAN (magic packet)',
  })
  wake(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: WakeAgentDto,
  ) {
    return this.agentsService.wakeAgent(id, user.sub, dto);
  }

  @Patch(':id/remote-access')
  @ApiOperation({
    summary: 'Cấu hình MAC WoL / RDP host (ghi đè metadata agent)',
  })
  updateRemoteAccess(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateRemoteAccessDto,
  ) {
    return this.agentsService.updateRemoteAccess(id, user.sub, dto);
  }

  @Post(':id/remote/start')
  @ApiOperation({
    summary: 'Mở ứng dụng RustDesk trên agent (không cài Windows service)',
  })
  startRemote(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.agentsGateway.startAgentRemote(id, user.sub);
  }

  @Post(':id/remote/stop')
  @ApiOperation({ summary: 'Đóng ứng dụng RustDesk trên agent' })
  stopRemote(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.agentsGateway.stopAgentRemote(id, user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an agent' })
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Ip() ip: string,
  ) {
    const res = await this.agentsService.remove(id, user.sub);
    await this.audit.record({
      actorId: user.sub,
      actorEmail: user.email,
      action: 'agent.delete',
      resource: 'agent',
      resourceId: id,
      ip,
    });
    return res;
  }
}
