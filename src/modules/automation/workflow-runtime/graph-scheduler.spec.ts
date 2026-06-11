import { OnFailure, StepType } from '@prisma/client';
import { executeGraphIndependent } from './graph-scheduler';
import { WF_TRIGGER_ID } from './graph-utils';
import type { WorkflowGraphEdge } from './graph-utils';
import { emptyCtx } from './run-context';

describe('executeGraphIndependent', () => {
  const steps = [
    {
      id: 'a',
      order: 1,
      type: StepType.DELAY,
      config: { delayMs: 10 },
      onFailure: OnFailure.STOP,
    },
    {
      id: 'b',
      order: 2,
      type: StepType.DELAY,
      config: { delayMs: 50 },
      onFailure: OnFailure.STOP,
    },
    {
      id: 'c',
      order: 3,
      type: StepType.DELAY,
      config: { delayMs: 1 },
      onFailure: OnFailure.STOP,
    },
  ];

  const edges: WorkflowGraphEdge[] = [
    { source: WF_TRIGGER_ID, target: 'a' },
    { source: WF_TRIGGER_ID, target: 'b' },
    { source: 'a', target: 'c' },
  ];

  it('runs child c before b finishes when a is fast', async () => {
    const started: string[] = [];
    const finished: string[] = [];

    await executeGraphIndependent('wf', steps, edges, {}, async (step) => {
      const ms = (step.config as { delayMs?: number }).delayMs ?? 1;
      started.push(step.id);
      await new Promise((r) => setTimeout(r, ms));
      finished.push(step.id);
      return {
        result: { step: step.order, stepId: step.id, status: 'completed' },
        nextCtx: emptyCtx({}),
        stop: false,
      };
    });

    expect(finished.indexOf('c')).toBeLessThan(finished.indexOf('b'));
  });

  it('repeats loop body via loop-back edge', async () => {
    const loopSteps = [
      {
        id: 'loop',
        order: 1,
        type: StepType.LOOP,
        config: { loopCount: 3 },
        onFailure: OnFailure.STOP,
      },
      {
        id: 'body',
        order: 2,
        type: StepType.DELAY,
        config: { delayMs: 1 },
        onFailure: OnFailure.STOP,
      },
      {
        id: 'done',
        order: 3,
        type: StepType.DELAY,
        config: { delayMs: 1 },
        onFailure: OnFailure.STOP,
      },
    ];
    const loopEdges: WorkflowGraphEdge[] = [
      { source: WF_TRIGGER_ID, target: 'loop' },
      { source: 'loop', target: 'body', sourceHandle: 'body' },
      { source: 'body', target: 'loop' },
      { source: 'loop', target: 'done', sourceHandle: 'done' },
    ];
    const bodyRuns: number[] = [];
    let loopIdx = 0;
    await executeGraphIndependent('wf', loopSteps, loopEdges, {}, async (step) => {
      if (step.id === 'body') bodyRuns.push(bodyRuns.length);
      let branch: string | undefined;
      if (step.id === 'loop') {
        branch = loopIdx < 3 ? 'body' : 'done';
        if (branch === 'body') loopIdx += 1;
      }
      return {
        result: {
          step: step.order,
          stepId: step.id,
          status: 'completed',
          branch,
        },
        nextCtx: emptyCtx({}),
        stop: false,
        branch,
      };
    });
    expect(bodyRuns).toEqual([0, 1, 2]);
  });
});
