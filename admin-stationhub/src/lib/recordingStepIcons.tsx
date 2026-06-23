import {
  AppWindow,
  Camera,
  Clock,
  Command,
  Eye,
  Keyboard,
  MousePointer2,
  Move,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';
import type { TaskType, WorkflowStepConfig } from '@/src/types/api';
import type { ChromeScriptAction } from '@/src/lib/chromeScriptSteps';
import type { DesktopAction } from '@/src/lib/desktopRecordingSteps';
import { desktopStepsFromWfPayload } from '@/src/lib/workflowGraph/recordingStepEdit';

const CHROME_ACTION_ICONS: Record<ChromeScriptAction, LucideIcon> = {
  click: MousePointer2,
  fill: Keyboard,
  delay: Clock,
  waitFor: Eye,
  snapshotDom: Camera,
};

const DESKTOP_ACTION_ICONS: Record<DesktopAction, LucideIcon> = {
  delay: Clock,
  openApp: AppWindow,
  move: Move,
  click: MousePointer2,
  typeText: Keyboard,
  keyCombo: Command,
  scroll: ScrollText,
};

export function chromeActionIcon(action: ChromeScriptAction): LucideIcon {
  return CHROME_ACTION_ICONS[action];
}

export function desktopActionIcon(action: DesktopAction): LucideIcon {
  return DESKTOP_ACTION_ICONS[action];
}

function chromeActionFromPayload(payload: unknown): ChromeScriptAction | null {
  const action = (payload as Record<string, unknown> | null | undefined)?.action;
  if (typeof action !== 'string') return null;
  return action in CHROME_ACTION_ICONS ? (action as ChromeScriptAction) : null;
}

function desktopActionFromPayload(payload: unknown): DesktopAction | null {
  const steps = desktopStepsFromWfPayload(payload);
  if (steps.length !== 1) return null;
  const action = steps[0]!.action;
  return action in DESKTOP_ACTION_ICONS ? action : null;
}

/** Icon theo bước Chrome/Desktop đơn lẻ trong payload — khớp thanh thêm bước. */
export function resolveRecordingStepIcon(
  taskType: TaskType | undefined,
  config?: WorkflowStepConfig,
): LucideIcon | null {
  if (!taskType || !config) return null;
  if (taskType === 'CHROME_EXTENSION') {
    const action = chromeActionFromPayload(config.payload);
    return action ? chromeActionIcon(action) : null;
  }
  if (taskType === 'DESKTOP_AUTOMATION') {
    const action = desktopActionFromPayload(config.payload);
    return action ? desktopActionIcon(action) : null;
  }
  return null;
}
