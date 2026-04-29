import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RemoteService } from './remote.service';
import { CreateRemoteSessionDto } from './dto/create-remote-session.dto';

@ApiTags('Remote')
@ApiBearerAuth()
@Controller('remote')
export class RemoteController {
  constructor(private readonly remote: RemoteService) {}

  @Post('sessions')
  @ApiOperation({ summary: 'Create remote control session (1 active per agent)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateRemoteSessionDto) {
    return this.remote.createSession(user, dto);
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get remote session status' })
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.remote.getSession(user, id);
  }

  @Post('sessions/:id/stop')
  @ApiOperation({ summary: 'End remote session' })
  stop(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.remote.stopSession(user, id, req.ip);
  }

  @Post('sessions/:id/heartbeat')
  @ApiOperation({ summary: 'Keep session alive (REST fallback)' })
  heartbeat(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.remote.heartbeatRest(user, id);
  }

  @Roles(Role.ADMIN)
  @Post('sessions/:id/panic')
  @ApiOperation({ summary: 'Force end session (admin)' })
  panic(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.remote.panicStop(user, id, req.ip);
  }
}
