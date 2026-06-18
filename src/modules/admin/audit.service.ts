import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          actorEmail: entry.actorEmail ?? null,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId ?? null,
          metadata: (entry.metadata ?? null) as Prisma.InputJsonValue,
          ip: entry.ip ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to record audit log: ${(err as Error).message}`,
      );
    }
  }

  async list(params: {
    page: number;
    limit: number;
    actor?: string;
    action?: string;
    resource?: string;
    resourceIn?: string;
    from?: string;
    to?: string;
  }) {
    const resources = params.resourceIn
      ?.split(',')
      .map((r) => r.trim())
      .filter(Boolean);

    const createdAt: Prisma.DateTimeFilter | undefined =
      params.from || params.to
        ? {
            ...(params.from && { gte: new Date(params.from) }),
            ...(params.to && {
              lte: new Date(`${params.to.slice(0, 10)}T23:59:59.999Z`),
            }),
          }
        : undefined;

    const where: Prisma.AuditLogWhereInput = {
      ...(params.actor && {
        actorEmail: { contains: params.actor, mode: 'insensitive' },
      }),
      ...(params.action && { action: params.action }),
      ...(params.resource && { resource: params.resource }),
      ...(resources?.length && { resource: { in: resources } }),
      ...(createdAt && { createdAt }),
    };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  }
}
