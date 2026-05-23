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
import { PaginationDto } from '../../common/dto/pagination.dto';
import { TasksService } from './tasks.service';
import {
  CreateTaskDto,
  CreateTaskTemplateDto,
  QueryTaskDto,
  UpdateTaskTemplateDto,
} from './dto/index';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /* Task templates — khai báo trước :id để không bị nuốt bởi Get(':id') */
  @Post('templates')
  @ApiOperation({ summary: 'Create task template (saved recipe, does not run)' })
  createTemplate(@CurrentUser() user: JwtPayload, @Body() dto: CreateTaskTemplateDto) {
    return this.tasksService.createTemplate(user.sub, dto);
  }

  @Get('templates')
  @ApiOperation({ summary: 'List my task templates' })
  listTemplates(@CurrentUser() user: JwtPayload, @Query() query: PaginationDto) {
    return this.tasksService.findAllTemplates(user.sub, query);
  }

  @Get('templates/:templateId')
  @ApiOperation({ summary: 'Get one task template' })
  getTemplate(
    @CurrentUser() user: JwtPayload,
    @Param('templateId') templateId: string,
  ) {
    return this.tasksService.getTemplateOrThrow(templateId, user.sub, false);
  }

  @Patch('templates/:templateId')
  @ApiOperation({ summary: 'Update task template' })
  updateTemplate(
    @CurrentUser() user: JwtPayload,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateTaskTemplateDto,
  ) {
    return this.tasksService.updateTemplate(templateId, user.sub, false, dto);
  }

  @Delete('templates/:templateId')
  @ApiOperation({ summary: 'Delete task template' })
  deleteTemplate(
    @CurrentUser() user: JwtPayload,
    @Param('templateId') templateId: string,
  ) {
    return this.tasksService.deleteTemplate(templateId, user.sub, false);
  }

  @Post('templates/:templateId/run')
  @ApiOperation({ summary: 'Create and queue task from template' })
  runTemplate(
    @CurrentUser() user: JwtPayload,
    @Param('templateId') templateId: string,
  ) {
    return this.tasksService.runTemplate(templateId, user.sub, false);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List tasks with filters' })
  findAll(@CurrentUser() user: JwtPayload, @Query() query: QueryTaskDto) {
    return this.tasksService.findAll(user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task details with logs' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tasksService.findOne(id, user.sub);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a task' })
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tasksService.cancel(id, user.sub);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Re-run a finished task' })
  retry(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.tasksService.retry(id, user.sub);
  }
}
