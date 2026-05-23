import { describe, expect, it } from 'vitest';
import {
  buildWaveProgressStatusMap,
  computeExecutionWaves,
} from './executionPlan';
import type { Workflow } from '@/src/types/api';

describe('executionPlan', () => {
  it('3 nhánh song song sóng 0, shell2 sóng 1', () => {
    const shell1 = '11111111-1111-1111-1111-111111111111';
    const shell2 = '22222222-2222-2222-2222-222222222222';
    const open = '33333333-3333-3333-3333-333333333333';
    const sys = '44444444-4444-4444-4444-444444444444';

    const wf: Workflow = {
      id: 'wf-1',
      name: 'Test',
      isActive: true,
      graph: {
        version: 2,
        edges: [
          { from: '__trigger__', to: shell1 },
          { from: '__trigger__', to: open },
          { from: '__trigger__', to: sys },
          { from: shell1, to: shell2 },
        ],
      },
      steps: [
        { order: 1, type: 'COMMAND', config: { stepKey: shell1, agentId: 'a' } },
        { order: 2, type: 'OPEN_APP', config: { stepKey: open, agentId: 'a' } },
        { order: 3, type: 'SYSTEM_INFO', config: { stepKey: sys, agentId: 'a' } },
        { order: 4, type: 'COMMAND', config: { stepKey: shell2, agentId: 'a' } },
      ],
    };

    const waves = computeExecutionWaves(wf);
    expect(waves).toHaveLength(2);
    expect(waves[0]).toHaveLength(3);
    expect(waves[1]).toEqual([shell2]);

    const m0 = buildWaveProgressStatusMap(waves, 0);
    expect(m0[shell1]).toBe('running');
    expect(m0[shell2]).toBe('pending');
    expect(m0[open]).toBe('running');

    const m1 = buildWaveProgressStatusMap(waves, 1);
    expect(m1[shell1]).toBe('completed');
    expect(m1[shell2]).toBe('running');
  });
});
