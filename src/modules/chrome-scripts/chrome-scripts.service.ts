import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaskType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateChromeScriptDto, UpdateChromeScriptDto } from './dto/index';
import type { AgentChromeScriptEntry } from '../../common/chrome-scripts-registry';

export type ChromeScriptsSyncSummary = {
  inserted: number;
  updated: number;
  skipped: number;
  total: number;
};

@Injectable()
export class ChromeScriptsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, agentId?: string) {
    return this.prisma.chromeScript.findMany({
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
    const row = await this.prisma.chromeScript.findFirst({
      where: { id, userId },
      include: { agent: { select: { id: true, name: true } } },
    });
    if (!row) throw new NotFoundException('Chrome script not found');
    return row;
  }

  async syncFromAgent(
    userId: string,
    agentId: string,
    scripts: AgentChromeScriptEntry[],
  ): Promise<ChromeScriptsSyncSummary> {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, userId },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const script of scripts) {
      const localId = script.id?.trim();
      const name = script.name?.trim();
      const steps = Array.isArray(script.steps) ? script.steps : [];
      if (!localId || !name || steps.length === 0) {
        skipped += 1;
        continue;
      }

      const existing = await this.prisma.chromeScript.findFirst({
        where: { userId, agentId, localId },
      });

      const data = {
        name,
        startUrl: script.startUrl?.trim() || null,
        steps: steps as Prisma.InputJsonValue,
        source: 'synced',
        localId,
        agentId,
      };

      if (existing) {
        await this.prisma.chromeScript.update({
          where: { id: existing.id },
          data,
        });
        updated += 1;
      } else {
        await this.prisma.chromeScript.create({
          data: { ...data, userId },
        });
        inserted += 1;
      }
    }

    return {
      inserted,
      updated,
      skipped,
      total: scripts.length,
    };
  }

  async update(id: string, userId: string, dto: UpdateChromeScriptDto) {
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
    return this.prisma.chromeScript.update({
      where: { id },
      data: {
        name,
        ...(dto.startUrl !== undefined
          ? { startUrl: dto.startUrl?.trim() || null }
          : {}),
        ...(dto.steps !== undefined
          ? { steps: dto.steps as Prisma.InputJsonValue }
          : {}),
      },
      include: {
        agent: { select: { id: true, name: true } },
      },
    });
  }

  async create(userId: string, dto: CreateChromeScriptDto) {
    if (!Array.isArray(dto.steps) || dto.steps.length === 0) {
      throw new BadRequestException('steps phải là mảng không rỗng');
    }
    if (dto.agentId) {
      const agent = await this.prisma.agent.findFirst({
        where: { id: dto.agentId, userId },
      });
      if (!agent) throw new NotFoundException('Agent not found');
    }
    return this.prisma.chromeScript.create({
      data: {
        userId,
        name: dto.name.trim(),
        startUrl: dto.startUrl?.trim() || null,
        steps: dto.steps as Prisma.InputJsonValue,
        source: dto.source?.trim() || 'recorded',
        agentId: dto.agentId || null,
      },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.chromeScript.delete({ where: { id } });
    return { ok: true };
  }

  async createTemplateFromScript(
    id: string,
    userId: string,
    agentId: string,
    templateName?: string,
  ) {
    const script = await this.findOne(id, userId);
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, userId },
    });
    if (!agent) throw new NotFoundException('Agent not found');

    const command = `${Array.isArray(script.steps) ? script.steps.length : 0} bước`;
    const payload: Record<string, unknown> = {
      steps: script.steps,
    };
    if (script.startUrl) {
      const pat = script.startUrl.endsWith('/')
        ? `${script.startUrl}*`
        : `${script.startUrl}*`;
      payload.urlPattern = pat;
    }

    const tpl = await this.prisma.taskTemplate.create({
      data: {
        userId,
        agentId: agent.id,
        name: templateName?.trim() || script.name,
        type: TaskType.CHROME_EXTENSION,
        command,
        payload: payload as Prisma.InputJsonValue,
        timeout: 300000,
      },
    });

    return { template: tpl, scriptId: script.id };
  }
}
