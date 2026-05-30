import type { WfNodeKind } from './types';

export type StepVarField = 'stdout' | 'exitCode';

export function slugOutputKey(s: string): string {
  const t = s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return t.length ? t.slice(0, 48) : '';
}

/** Node task xuất output vào scope `steps.<key>`. */
export function nodeExportsStepVariables(kind: WfNodeKind): boolean {
  return kind === 'task';
}

export function formatStepVar(key: string, field: StepVarField = 'stdout'): string {
  return `{{steps.${key}.${field}}}`;
}

export function resolveStepOutputKey(
  config: { outputKey?: string; title?: string; stepKey?: string },
  label: string,
  nodeId: string,
): string {
  const custom = config.outputKey?.trim();
  if (custom) return slugOutputKey(custom) || custom.replace(/\s+/g, '_');
  const fromTitle = slugOutputKey(config.title ?? label ?? '');
  if (fromTitle) return fromTitle;
  const sk = config.stepKey?.trim();
  if (sk) {
    const fromKey = slugOutputKey(sk);
    if (fromKey) return fromKey;
    if (!sk.startsWith('step-')) return sk.replace(/\s+/g, '_').slice(0, 48);
  }
  return slugOutputKey(nodeId) || nodeId.slice(0, 48);
}

export function stepVarRefs(key: string): { stdout: string; exitCode: string } {
  return {
    stdout: formatStepVar(key, 'stdout'),
    exitCode: formatStepVar(key, 'exitCode'),
  };
}
