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
import { TasksService } from './tasks.service';
import { CreateTaskDto, QueryTaskDto } from './dto/index';

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

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
}
