import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TaskType, OnFailure } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/index';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private prisma: PrismaService,
    private tasksService: TasksService,
  ) {}

  async create(userId: string, dto: CreateWorkflowDto) {
    return this.prisma.workflow.create({
      data: {
        name: dto.name,
        description: dto.description,
        cronExpression: dto.cronExpression,
        isActive: dto.isActive ?? true,
        userId,
        steps: {
          create: dto.steps.map((step) => ({
            order: step.order,
            type: step.type,
            config: step.config as object,
            onFailure: step.onFailure ?? OnFailure.STOP,
          })),
        },
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  async findAll(userId: string, pagination: PaginationDto) {
    const where = { userId };
    const [workflows, total] = await Promise.all([
      this.prisma.workflow.findMany({
        where,
        include: { steps: { orderBy: { order: 'asc' } } },
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workflow.count({ where }),
    ]);
    return new PaginatedResponseDto(workflows, total, pagination);
  }

  async findOne(id: string, userId: string) {
    const workflow = await this.prisma.workflow.findFirst({
      where: { id, userId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async update(id: string, userId: string, dto: UpdateWorkflowDto) {
    await this.findOne(id, userId);

    const { steps, ...workflowData } = dto;

    if (steps) {
      await this.prisma.workflowStep.deleteMany({ where: { workflowId: id } });
    }

    return this.prisma.workflow.update({
      where: { id },
      data: {
        ...workflowData,
        ...(steps && {
          steps: {
            create: steps.map((step) => ({
              order: step.order,
              type: step.type,
              config: step.config as object,
              onFailure: step.onFailure ?? OnFailure.STOP,
            })),
          },
        }),
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    await this.prisma.workflow.delete({ where: { id } });
    return { message: 'Workflow deleted successfully' };
  }

  async execute(id: string, userId: string) {
    const workflow = await this.findOne(id, userId);
    const results: Array<{ step: number; status: string; taskId?: string; error?: string }> = [];

    for (const step of workflow.steps) {
      try {
        const config = step.config as { command?: string; agentId?: string; delayMs?: number };

        if (step.type === 'DELAY') {
          const delayMs = config.delayMs || 1000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          results.push({ step: step.order, status: 'completed' });
          continue;
        }

        if (!config.command || !config.agentId) {
          throw new Error('Step config missing command or agentId');
        }

        const task = await this.tasksService.create(userId, {
          type: step.type as unknown as TaskType,
          command: config.command,
          agentId: config.agentId,
        });
        results.push({ step: step.order, status: 'queued', taskId: task.id });
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        results.push({ step: step.order, status: 'failed', error: errMsg });

        if (step.onFailure === OnFailure.STOP) {
          this.logger.warn(`Workflow ${id}: stopping at step ${step.order}`);
          break;
        }
        if (step.onFailure === OnFailure.RETRY) {
          this.logger.warn(`Workflow ${id}: retry not implemented, skipping step ${step.order}`);
        }
      }
    }

    return { workflowId: id, name: workflow.name, results };
  }
}
