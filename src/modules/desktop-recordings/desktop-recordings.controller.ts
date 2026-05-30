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
import { DesktopRecordingsService } from './desktop-recordings.service';
import { CreateDesktopRecordingDto, UpdateDesktopRecordingDto } from './dto/index';

@ApiTags('Desktop Recordings')
@ApiBearerAuth()
@Controller('desktop-recordings')
export class DesktopRecordingsController {
  constructor(
    private readonly service: DesktopRecordingsService,
    private readonly agentsGateway: AgentsGateway,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List desktop recordings for current user' })
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('agentId') agentId?: string,
  ) {
    return this.service.findAll(user.sub, agentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get desktop recording by id' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.findOne(id, user.sub);
  }

  @Post('sync')
  @ApiOperation({
    summary: 'Pull all local desktop recordings from agent and upsert to DB',
  })
  syncFromAgent(
    @CurrentUser() user: JwtPayload,
    @Body() body: { agentId: string },
  ) {
    if (!body?.agentId?.trim()) {
      throw new BadRequestException('agentId required');
    }
    return this.agentsGateway.syncDesktopRecordings(body.agentId.trim(), user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update desktop recording metadata and steps' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateDesktopRecordingDto,
  ) {
    return this.service.update(id, user.sub, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Create desktop recording (import JSON)' })
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateDesktopRecordingDto,
  ) {
    return this.service.create(user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete desktop recording' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.remove(id, user.sub);
  }

  @Post(':id/create-template')
  @ApiOperation({ summary: 'Create DESKTOP_AUTOMATION task template from recording' })
  createTemplate(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { agentId: string; name?: string },
  ) {
    if (!body?.agentId) {
      throw new BadRequestException('agentId required');
    }
    return this.service.createTemplateFromRecording(
      id,
      user.sub,
      body.agentId,
      body.name,
    );
  }
}
