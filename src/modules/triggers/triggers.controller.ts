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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CreateTelegramBotDto, CreateWorkflowTriggerDto } from './dto/create-trigger.dto';
import { TriggersService } from './triggers.service';

@ApiTags('Workflow Triggers')
@ApiBearerAuth()
@Controller('triggers')
export class TriggersController {
  constructor(private readonly triggers: TriggersService) {}

  @Get('telegram/bots')
  @ApiOperation({ summary: 'List Telegram bots' })
  listBots(@CurrentUser() user: JwtPayload) {
    return this.triggers.listBots(user.sub);
  }

  @Post('telegram/bots')
  @ApiOperation({ summary: 'Register Telegram bot (webhook)' })
  createBot(@CurrentUser() user: JwtPayload, @Body() dto: CreateTelegramBotDto) {
    return this.triggers.createBot(user.sub, dto);
  }

  @Delete('telegram/bots/:botId')
  @ApiOperation({ summary: 'Remove Telegram bot' })
  deleteBot(@CurrentUser() user: JwtPayload, @Param('botId') botId: string) {
    return this.triggers.deleteBot(user.sub, botId);
  }

  @Get()
  @ApiOperation({ summary: 'List workflow triggers' })
  list(
    @CurrentUser() user: JwtPayload,
    @Query('workflowId') workflowId?: string,
  ) {
    return this.triggers.listTriggers(user.sub, workflowId);
  }

  @Post()
  @ApiOperation({ summary: 'Create workflow trigger' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateWorkflowTriggerDto) {
    return this.triggers.createTrigger(user.sub, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get trigger detail + execution history' })
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.triggers.findTrigger(user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update trigger (enable/disable, schedule, match)' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: Partial<CreateWorkflowTriggerDto>,
  ) {
    return this.triggers.updateTrigger(user.sub, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete trigger' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.triggers.deleteTrigger(user.sub, id);
  }
}
