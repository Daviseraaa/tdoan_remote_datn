import { asciiSlugKey } from '@/src/lib/slugKey';
import type { WfNodeKind } from './types';
import type { WorkflowExcelMode, WorkflowVariableMode } from '@/src/types/api';

export type StepVarField = 'stdout' | 'exitCode';

export function slugOutputKey(s: string): string {
  return asciiSlugKey(s);
}

/** Node task / đọc biến xuất output vào scope `steps.<key>`. Tạo/gán chỉ ghi `workflow.<name>`. */
export function nodeExportsStepVariables(
  kind: WfNodeKind,
  config?: { variableMode?: WorkflowVariableMode },
): boolean {
  if (kind === 'task') return true;
  if (kind === 'variable') return (config?.variableMode ?? 'set') === 'read';
  return false;
}

/** Giá trị hiển thị ô tên biến — để trống nếu chưa đặt hoặc trùng default (placeholder). */
export function workflowVarNameInputValue(
  kind: WfNodeKind,
  variableName?: string,
): string {
  const trimmed = variableName?.trim() ?? '';
  if (!trimmed) return '';
  const def = kind === 'excel' ? 'excel_data' : 'my_var';
  if (trimmed === def) return '';
  return trimmed;
}

/** Tên biến workflow khi node publish — default theo loại node. */
export function resolveWorkflowVarName(
  kind: WfNodeKind,
  config?: { variableName?: string; excelMode?: WorkflowExcelMode },
): string {
  const name = config?.variableName?.trim();
  if (name) return name;
  if (kind === 'excel') return 'excel_data';
  return 'my_var';
}

export function nodePublishesWorkflowVar(
  kind: WfNodeKind,
  config?: { variableMode?: WorkflowVariableMode; excelMode?: WorkflowExcelMode },
): boolean {
  if (kind === 'excel') return (config?.excelMode ?? 'read') === 'read';
  if (kind !== 'variable') return false;
  const mode = config?.variableMode ?? 'set';
  return mode === 'create' || mode === 'set';
}

export function formatWorkflowVar(name: string): string {
  return `{{workflow.${name}}}`;
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

export function formatTelegramVar(path: string): string {
  return `{{telegram.${path}}}`;
}

/** Biến từ payload Telegram khi trigger loại TELEGRAM. */
export const TELEGRAM_TRIGGER_VAR_KEYS = [
  'chatId',
  'userId',
  'username',
  'text',
  'messageId',
  'command',
  'callbackData',
  'event',
  'argsText',
  'args.0',
] as const;

export function stepVarRefs(key: string): { stdout: string; exitCode: string } {
  return {
    stdout: formatStepVar(key, 'stdout'),
    exitCode: formatStepVar(key, 'exitCode'),
  };
}
