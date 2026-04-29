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
import { AutomationService } from './automation.service';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/index';

@ApiTags('Automation / Workflows')
@ApiBearerAuth()
@Controller('workflows')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workflow' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateWorkflowDto) {
    return this.automationService.create(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List workflows' })
  findAll(@CurrentUser() user: JwtPayload, @Query() pagination: PaginationDto) {
    return this.automationService.findAll(user.sub, pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workflow details' })
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.automationService.findOne(id, user.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a workflow' })
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.automationService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workflow' })
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.automationService.remove(id, user.sub);
  }

  @Post(':id/execute')
  @ApiOperation({ summary: 'Execute a workflow manually' })
  execute(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.automationService.execute(id, user.sub);
  }
}
