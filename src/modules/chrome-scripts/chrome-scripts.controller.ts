import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { AgentsGateway } from '../agents/agents.gateway';
import { ChromeScriptsService } from './chrome-scripts.service';
import { CreateChromeScriptDto, UpdateChromeScriptDto } from './dto/index';

@ApiTags('Chrome Scripts')
@ApiBearerAuth()
@Controller('chrome-scripts')
export class ChromeScriptsController {
  constructor(
    private readonly service: ChromeScriptsService,
    private readonly agentsGateway: AgentsGateway,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List Chrome scripts for current user' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('agentId') agentId?: string,
  ) {
    return this.service.findAll(user.sub, agentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get Chrome script by id' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.findOne(id, user.sub);
  }

  @Post('sync')
  @ApiOperation({
    summary: 'Pull all local Chrome scripts from agent and upsert to DB',
  })
  syncFromAgent(
    @CurrentUser() user: JwtPayload,
    @Body() body: { agentId: string },
  ) {
    if (!body?.agentId?.trim()) {
      throw new BadRequestException('agentId required');
    }
    return this.agentsGateway.syncChromeScripts(body.agentId.trim(), user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Chrome script metadata and steps' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateChromeScriptDto,
  ) {
    return this.service.update(id, user.sub, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create Chrome script (import JSON)' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateChromeScriptDto,
  ) {
    return this.service.create(user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete Chrome script' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.remove(id, user.sub);
  }

  @Post(':id/create-template')
  @ApiOperation({ summary: 'Create CHROME_EXTENSION task template from script' })
  createTemplate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { agentId: string; name?: string },
  ) {
    if (!body?.agentId) {
      throw new BadRequestException('agentId required');
    }
    return this.service.createTemplateFromScript(
      id,
      user.sub,
      body.agentId,
      body.name,
    );
  }
}
