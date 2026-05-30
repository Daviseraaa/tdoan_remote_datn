import { OnFailure, StepType, TaskStatus } from '@prisma/client';
import { AutomationService, WF_TRIGGER_ID } from './automation.service';
import type { WorkflowGraphEdge } from './automation.service';
import { scopeFromContext } from './workflow-variables';

describe('AutomationService.executeGraph (independent flows)', () => {
  const prisma = { workflow: { update: jest.fn() } };
  const tasksService = {};
  const workflowRuntime = {
    upsertStepRun: jest.fn(),
    markFlowStopped: jest.fn(),
  };
  const telegramActions = { runAction: jest.fn() };
  const telegramProgress = {
    registerRun: jest.fn(),
    onStepStart: jest.fn(),
    onStepEnd: jest.fn(),
    finalize: jest.fn(),
  };
  let service: AutomationService;
  let maxInFlight: number;
  let inFlight: number;
  const startOrder: string[] = [];
  const endOrder: string[] = [];

  const workflow = {
    id: 'wf-parallel',
    name: 'Parallel test',
    userId: 'u1',
    steps: [
      {
        id: 'delay',
        order: 1,
        type: StepType.DELAY,
        config: { delayMs: 5, stepKey: 'delay' },
        onFailure: OnFailure.STOP,
      },
      {
        id: 'sys',
        order: 2,
        type: StepType.DELAY,
        config: { delayMs: 80, stepKey: 'sys' },
        onFailure: OnFailure.STOP,
      },
      {
        id: 'open',
        order: 3,
        type: StepType.DELAY,
        config: { delayMs: 1, stepKey: 'open' },
        onFailure: OnFailure.STOP,
      },
      {
        id: 'shell',
        order: 4,
        type: StepType.DELAY,
        config: { delayMs: 1, stepKey: 'shell' },
        onFailure: OnFailure.STOP,
      },
    ],
  };

  const graphEdges: WorkflowGraphEdge[] = [
    { source: WF_TRIGGER_ID, target: 'delay' },
    { source: WF_TRIGGER_ID, target: 'sys' },
    { source: 'delay', target: 'open' },
    { source: 'sys', target: 'shell' },
  ];

  beforeEach(() => {
    maxInFlight = 0;
    inFlight = 0;
    startOrder.length = 0;
    endOrder.length = 0;
    service = new AutomationService(
      prisma as never,
      tasksService as never,
      workflowRuntime as never,
      telegramActions as never,
      telegramProgress as never,
    );
    jest
      .spyOn(AutomationService.prototype as never, 'runStep' as never)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((async (_userId: string, step: { order: number; id: string; config: { delayMs?: number } }, ctx: any) => {
        const ms = step.config?.delayMs ?? 1;
        startOrder.push(step.id);
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((r) => setTimeout(r, ms));
        inFlight -= 1;
        endOrder.push(step.id);
        return {
          result: {
            step: step.order,
            stepId: step.id,
            status: 'completed',
          },
          ctx: ctx.scope ? ctx : { ...ctx, scope: scopeFromContext({}, {}) },
          stop: false,
        };
      }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('schedules child on branch without waiting for sibling branch', async () => {
    const results = await (
      service as unknown as {
        executeGraphInternal: (
          id: string,
          wf: typeof workflow,
          userId: string,
          edges: WorkflowGraphEdge[],
        ) => Promise<{ stepId?: string; depth?: number; path?: string }[]>;
      }
    ).executeGraphInternal('wf-parallel', workflow, 'u1', graphEdges);

    expect(endOrder.indexOf('open')).toBeLessThan(endOrder.indexOf('sys'));

    const byId = Object.fromEntries(
      results.filter((r) => r.stepId).map((r) => [r.stepId!, r]),
    );
    expect(byId.delay?.depth).toBe(0);
    expect(byId.sys?.depth).toBe(0);
    expect(byId.open?.depth).toBe(1);
    expect(byId.shell?.depth).toBe(1);
    expect(maxInFlight).toBeGreaterThanOrEqual(2);
  });
});

describe('AutomationService.runStep (templates)', () => {
  const prisma = { task: { findFirst: jest.fn() } };
  const tasksService = { create: jest.fn() };
  const workflowRuntime = {
    upsertStepRun: jest.fn(),
    markFlowStopped: jest.fn(),
  };
  const telegramActions = { runAction: jest.fn() };
  const telegramProgress = {
    registerRun: jest.fn(),
    onStepStart: jest.fn(),
    onStepEnd: jest.fn(),
    finalize: jest.fn(),
  };
  let service: AutomationService;

  beforeEach(() => {
    service = new AutomationService(
      prisma as never,
      tasksService as never,
      workflowRuntime as never,
      telegramActions as never,
      telegramProgress as never,
    );
  });

  it('resolves {{steps.*}} in command before create task', async () => {
    tasksService.create.mockResolvedValue({ id: 'task-1' });
    prisma.task.findFirst.mockResolvedValue({
      status: TaskStatus.COMPLETED,
      exitCode: 0,
      result: 'ok',
    });

    const ctx = {
      exitCode: 0,
      failed: false,
      scope: scopeFromContext({}, {
        prev: {
          stdout: 'hello',
          exitCode: 0,
          failed: false,
          stepId: 's1',
          order: 1,
        },
      }),
    };

    const result = await (
      service as unknown as {
        runStep: (userId: string, step: object, c: typeof ctx) => Promise<unknown>;
      }
    ).runStep('u1', {
      id: 's2',
      order: 2,
      type: StepType.COMMAND,
      config: {
        agentId: 'a1',
        command: 'echo {{steps.prev.stdout}}',
        outputKey: 'out2',
      },
      onFailure: OnFailure.STOP,
    }, ctx);

    expect(tasksService.create).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ command: 'echo hello' }),
      undefined,
    );
    expect((result as { result: { status: string } }).result.status).toBe('completed');
  });

  it('CHROME_EXTENSION with command [] builds JSON steps (not PowerShell)', async () => {
    tasksService.create.mockResolvedValue({ id: 'task-chrome' });
    prisma.task.findFirst.mockResolvedValue({
      status: TaskStatus.COMPLETED,
      exitCode: 0,
      result: '{}',
    });

    await (
      service as unknown as {
        runStep: (userId: string, step: object, c: object) => Promise<unknown>;
      }
    ).runStep(
      'u1',
      {
        id: 'chrome-1',
        order: 1,
        type: StepType.COMMAND,
        config: {
          agentId: 'a1',
          taskType: 'CHROME_EXTENSION',
          command: '[]',
          payload: { action: 'snapshotDom', urlPattern: 'https://example.com/*' },
        },
        onFailure: OnFailure.STOP,
      },
      { exitCode: 0, failed: false, scope: { workflow: {}, steps: {} } },
    );

    expect(tasksService.create).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        type: 'CHROME_EXTENSION',
        command: expect.stringContaining('snapshotDom'),
      }),
      undefined,
    );
    const call = tasksService.create.mock.calls[0][1] as { command: string };
    expect(call.command).not.toBe('[]');
    expect(() => JSON.parse(call.command)).not.toThrow();
  });
});
