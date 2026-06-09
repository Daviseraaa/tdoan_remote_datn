import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { AgentsGateway } from './agents.gateway';
import { AgentsService } from './agents.service';
import {
  CreateAgentDto,
  QueryAgentDto,
  UpdateRemoteAccessDto,
  WakeAgentDto,
} from './dto/index';

@ApiTags('Agents')
@ApiBearerAuth()
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly agentsGateway: AgentsGateway,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Register a new agent' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAgentDto) {
    return this.agentsService.create(user.sub, dto);
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

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an agent' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.agentsService.remove(id, user.sub);
  }
}
