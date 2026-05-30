import {
  buildStepOutput,
  mergeScopes,
  parseTaskResult,
  publishStepOutput,
  resolveOutputKey,
  resolveTemplateString,
  scopeFromContext,
} from './workflow-variables';

describe('workflow-variables', () => {
  const baseScope = scopeFromContext(
    { API_URL: 'https://example.com' },
    {
      delay1: {
        exitCode: 0,
        stdout: 'hello',
        failed: false,
        stepId: 'a',
        order: 1,
      },
    },
  );

  it('resolves workflow and steps templates', () => {
    expect(resolveTemplateString('curl {{workflow.API_URL}}/x', baseScope)).toBe(
      'curl https://example.com/x',
    );
    expect(resolveTemplateString('echo {{steps.delay1.stdout}}', baseScope)).toBe(
      'echo hello',
    );
  });

  it('resolves prev shorthand with single step', () => {
    expect(resolveTemplateString('{{prev.stdout}}', baseScope)).toBe('hello');
    expect(resolveTemplateString('{{prev.exitCode}}', baseScope)).toBe('0');
  });

  it('returns empty for missing keys', () => {
    expect(resolveTemplateString('{{steps.missing.stdout}}', baseScope)).toBe('');
  });

  it('parses task result json', () => {
    const p = parseTaskResult(
      JSON.stringify({ stdout: 'out', stderr: 'err', exitCode: 0 }),
      0,
      false,
    );
    expect(p.stdout).toBe('out');
    expect(p.stderr).toBe('err');
  });

  it('publishStepOutput updates scope', () => {
    const s = scopeFromContext({}, {});
    const next = publishStepOutput(s, 'b', {
      exitCode: 0,
      stdout: 'x',
      failed: false,
      stepId: 'id2',
      order: 2,
    });
    expect(next.steps.b?.stdout).toBe('x');
    expect(next.prev?.stdout).toBe('x');
  });

  it('mergeScopes unions step outputs and prev = latest order', () => {
    const a = scopeFromContext({}, {
      a: { exitCode: 0, failed: false, stepId: '1', order: 1, stdout: 'a' },
    });
    const b = scopeFromContext({}, {
      b: { exitCode: 0, failed: false, stepId: '2', order: 2, stdout: 'b' },
    });
    const m = mergeScopes([a, b]);
    expect(m.steps.a?.stdout).toBe('a');
    expect(m.steps.b?.stdout).toBe('b');
    expect(m.prev?.stdout).toBe('b');
  });

  it('steps.*.stdout falls back to result when stdout empty', () => {
    const scope = scopeFromContext({}, {
      cmd: {
        exitCode: 0,
        failed: false,
        stepId: '1',
        order: 1,
        result: 'plain-output',
      },
    });
    expect(resolveTemplateString('{{steps.cmd.stdout}}', scope)).toBe(
      'plain-output',
    );
  });

  it('resolveOutputKey prefers stepKey from config', () => {
    expect(
      resolveOutputKey(
        { stepKey: 'my_canvas_node', title: '' },
        1,
        'uuid-from-db',
      ),
    ).toBe('my_canvas_node');
  });

  it('defaultOutputKey from title', () => {
    expect(resolveOutputKey({ title: 'System Info' }, 2, 'uuid')).toBe('system_info');
  });

  it('buildStepOutput uses outputKey', () => {
    const { key, output } = buildStepOutput(
      { id: 's1', order: 1 },
      { outputKey: 'sys' },
      { exitCode: 0, failed: false, result: '{"stdout":"ok"}' },
    );
    expect(key).toBe('sys');
    expect(output.stdout).toBe('ok');
  });
});
