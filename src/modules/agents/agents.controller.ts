import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { AgentsGateway } from './agents.gateway';
import { AgentsService } from './agents.service';
import { CreateAgentDto, QueryAgentDto } from './dto/index';

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

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an agent' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.agentsService.remove(id, user.sub);
  }
}
