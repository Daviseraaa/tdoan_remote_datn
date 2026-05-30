import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaskType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDesktopRecordingDto, UpdateDesktopRecordingDto } from './dto/index';
import type { AgentDesktopRecordingEntry } from '../../common/desktop-recordings-registry';

export type DesktopRecordingsSyncSummary = {
  inserted: number;
  updated: number;
  skipped: number;
  total: number;
};

@Injectable()
export class DesktopRecordingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, agentId?: string) {
    return this.prisma.desktopRecording.findMany({
      where: {
        userId,
        ...(agentId ? { agentId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        agent: { select: { id: true, name: true } },
      },
    });
  }

  async findOne(id: string, userId: string) {
    const row = await this.prisma.desktopRecording.findFirst({
      where: { id, userId },
      include: { agent: { select: { id: true, name: true } } },
    });
    if (!row) throw new NotFoundException('Desktop recording not found');
    return row;
  }

  async syncFromAgent(
    userId: string,
    agentId: string,
    recordings: AgentDesktopRecordingEntry[],
  ): Promise<DesktopRecordingsSyncSummary> {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, userId },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const rec of recordings) {
      const localId = rec.id?.trim();
      const name = rec.name?.trim();
      const steps = Array.isArray(rec.steps) ? rec.steps : [];
      if (!localId || !name || steps.length === 0) {
        skipped += 1;
        continue;
      }

      const existing = await this.prisma.desktopRecording.findFirst({
        where: { userId, agentId, localId },
      });

      const data = {
        name,
        steps: steps as Prisma.InputJsonValue,
        source: 'synced',
        localId,
        agentId,
      };

      if (existing) {
        await this.prisma.desktopRecording.update({
          where: { id: existing.id },
          data,
        });
        updated += 1;
      } else {
        await this.prisma.desktopRecording.create({
          data: { ...data, userId },
        });
        inserted += 1;
      }
    }

    return {
      inserted,
      updated,
      skipped,
      total: recordings.length,
    };
  }

  async update(id: string, userId: string, dto: UpdateDesktopRecordingDto) {
    const existing = await this.findOne(id, userId);
    if (dto.steps !== undefined) {
      if (!Array.isArray(dto.steps) || dto.steps.length === 0) {
        throw new BadRequestException('steps phải là mảng không rỗng');
      }
    }
    const name = dto.name?.trim() || existing.name;
    if (!name) {
      throw new BadRequestException('name không được rỗng');
    }
    return this.prisma.desktopRecording.update({
      where: { id },
      data: {
        name,
        ...(dto.steps !== undefined
          ? { steps: dto.steps as Prisma.InputJsonValue }
          : {}),
      },
      include: {
        agent: { select: { id: true, name: true } },
      },
    });
  }

  async create(userId: string, dto: CreateDesktopRecordingDto) {
    if (!Array.isArray(dto.steps) || dto.steps.length === 0) {
      throw new BadRequestException('steps phải là mảng không rỗng');
    }
    if (dto.agentId) {
      const agent = await this.prisma.agent.findFirst({
        where: { id: dto.agentId, userId },
      });
      if (!agent) throw new NotFoundException('Agent not found');
    }
    return this.prisma.desktopRecording.create({
      data: {
        userId,
        name: dto.name.trim(),
        steps: dto.steps as Prisma.InputJsonValue,
        source: dto.source?.trim() || 'recorded',
        agentId: dto.agentId || null,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.desktopRecording.delete({ where: { id } });
    return { ok: true };
  }

  async createTemplateFromRecording(
    id: string,
    userId: string,
    agentId: string,
    templateName?: string,
  ) {
    const recording = await this.findOne(id, userId);
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, userId },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    const tpl = await this.prisma.taskTemplate.create({
      data: {
        userId,
        agentId: agent.id,
        name: templateName?.trim() || recording.name,
        type: TaskType.DESKTOP_AUTOMATION,
        command: `${Array.isArray(recording.steps) ? recording.steps.length : 0} bước`,
        payload: { steps: recording.steps } as Prisma.InputJsonValue,
        timeout: 300000,
      },
    });

    return { template: tpl, recordingId: recording.id };
  }
}
