import type { WorkflowStepRunOutput } from '@/src/types/api';

function formatWorkflowVarJson(json: Record<string, unknown>): string | null {
  if (typeof json.name !== 'string' || !Object.prototype.hasOwnProperty.call(json, 'value')) {
    return null;
  }
  const valueStr =
    typeof json.value === 'string'
      ? json.value
      : JSON.stringify(json.value, null, 2);
  const meta: string[] = [];
  if (typeof json.rowCount === 'number') meta.push(`${json.rowCount} dòng`);
  if (typeof json.sheet === 'string' && json.sheet) meta.push(`sheet: ${json.sheet}`);
  const header = meta.length
    ? `workflow.${json.name} (${meta.join(', ')})`
    : `workflow.${json.name}`;
  return `${header}:\n${valueStr}`;
}

export function formatStepRunOutput(output?: WorkflowStepRunOutput | null): string {
  if (!output) return '';
  if (output.json && typeof output.json === 'object' && !Array.isArray(output.json)) {
    const varBlock = formatWorkflowVarJson(output.json as Record<string, unknown>);
    if (varBlock) {
      const summary = output.stdout?.trim();
      return summary ? `${summary}\n\n${varBlock}` : varBlock;
    }
  }
  if (output.stdout?.trim()) return output.stdout;
  if (output.actionResult?.trim()) return output.actionResult;
  if (output.stderr?.trim()) return output.stderr;
  if (output.json !== undefined && output.json !== null) {
    try {
      return typeof output.json === 'string'
        ? output.json
        : JSON.stringify(output.json, null, 2);
    } catch {
      return String(output.json);
    }
  }
  if (output.branch) return `branch: ${output.branch}`;
  return '';
}

export function hasStepRunOutput(output?: WorkflowStepRunOutput | null): boolean {
  return formatStepRunOutput(output).length > 0;
}
