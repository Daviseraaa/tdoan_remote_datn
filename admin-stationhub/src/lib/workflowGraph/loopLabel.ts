import { t } from '@/src/i18n/t';
import type { WorkflowStepConfig } from '@/src/types/api';

export function loopNodeLabel(config: WorkflowStepConfig): string {
  const arrayVar = config.loopArrayVar?.trim();
  if (config.loopMode === 'array' && arrayVar) {
    return t('workflows.nodeLoopArray', { var: arrayVar });
  }
  const varName = config.loopCountVar?.trim();
  if (config.loopMode === 'variable' && varName) {
    return t('workflows.nodeLoopVar', { var: varName });
  }
  return t('workflows.nodeLoop', { count: config.loopCount ?? 3 });
}
