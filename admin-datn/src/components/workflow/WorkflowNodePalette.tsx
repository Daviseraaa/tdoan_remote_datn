import React from 'react';
import {
  Clock,
  GitBranch,
  MessageCircle,
} from 'lucide-react';
import { t } from '@/src/i18n/t';
import type { ChromeScript, DesktopRecording, TaskTemplate, TaskType, Workflow } from '@/src/types/api';
import { taskTypeIcon } from '@/src/lib/taskTypeIcons';
import { WfImportMenu } from './WfImportMenu';
import { WfRecordingStepPalette, WfRecordingStepPaletteLabel } from './WfRecordingStepPalette';
import type { ChromeScriptAction } from '@/src/lib/chromeScriptSteps';
import type { DesktopAction } from '@/src/lib/desktopRecordingSteps';

/** Lệnh shell, script, thu thập thông tin hệ thống */
const SHELL_TASK_ITEMS: TaskType[] = ['COMMAND', 'SCRIPT', 'SYSTEM_INFO'];

/** Mở app, tự động hóa desktop, chụp màn hình */
const DESKTOP_TASK_ITEMS: TaskType[] = ['OPEN_APP', 'DESKTOP_AUTOMATION', 'SCREEN_CAPTURE'];

/** Trình duyệt & extension Chrome */
const BROWSER_TASK_ITEMS: TaskType[] = ['OPEN_BROWSER', 'CHROME_EXTENSION'];

const ALL_TASK_ITEMS: TaskType[] = [
  ...SHELL_TASK_ITEMS,
  ...DESKTOP_TASK_ITEMS,
  ...BROWSER_TASK_ITEMS,
];

type Props = {
  onAddDelay: () => void;
  onAddCondition: () => void;
  onAddTelegram: () => void;
  onAddTask: (type: TaskType) => void;
  onImportChromeScript: (script: ChromeScript) => void;
  onImportDesktopRecording: (recording: DesktopRecording) => void;
  onImportTaskTemplate: (template: TaskTemplate) => void;
  onImportWorkflow: (workflow: Workflow) => void;
  onAddChromeStep: (action: ChromeScriptAction) => void;
  onAddDesktopStep: (action: DesktopAction) => void;
  collapsed?: boolean;
  chainNextStep?: boolean;
};

function PaletteSectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[9px] font-mono font-bold uppercase tracking-wide text-on-surface-variant/70 px-4 pb-2 pt-1">
      {label}
    </p>
  );
}

function FlowControlButtons({
  onAddDelay,
  onAddCondition,
  onAddTelegram,
  compact,
}: {
  onAddDelay: () => void;
  onAddCondition: () => void;
  onAddTelegram: () => void;
  compact?: boolean;
}) {
  const btn = (className: string, title: string, onClick: () => void, icon: React.ReactNode) =>
    compact ? (
      <button
        type="button"
        title={title}
        onClick={onClick}
        className={`w-9 h-9 rounded-lg border flex items-center justify-center ${className}`}
      >
        {icon}
      </button>
    ) : null;

  if (compact) {
    return (
      <>
        {btn(
          'border-white/10 hover:bg-white/5',
          t('workflows.nodeDelay', { ms: 1000 }),
          onAddDelay,
          <Clock size={16} />,
        )}
        {btn(
          'border-amber-400/25 hover:bg-amber-400/10 text-amber-400',
          t('workflows.nodeCondition'),
          onAddCondition,
          <GitBranch size={16} />,
        )}
        {btn(
          'border-sky-400/25 hover:bg-sky-400/10 text-sky-400',
          t('workflows.paletteTelegram'),
          onAddTelegram,
          <MessageCircle size={16} />,
        )}
      </>
    );
  }

  return (
    <div className="px-2 pb-1 space-y-1">
      <button
        type="button"
        onClick={onAddDelay}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-left text-sm font-bold"
      >
        <Clock size={16} className="text-primary shrink-0" />
        {t('workflows.nodeDelay', { ms: 1000 })}
      </button>
      <button
        type="button"
        onClick={onAddCondition}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-amber-400/25 hover:bg-amber-400/10 text-left text-sm font-bold"
      >
        <GitBranch size={16} className="text-amber-400 shrink-0" />
        {t('workflows.nodeCondition')}
      </button>
      <button
        type="button"
        onClick={onAddTelegram}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-sky-400/25 hover:bg-sky-400/10 text-left text-sm font-bold"
      >
        <MessageCircle size={16} className="text-sky-400 shrink-0" />
        {t('workflows.paletteTelegram')}
      </button>
    </div>
  );
}

function TaskPaletteButtons({
  items,
  onAddTask,
  compact,
}: {
  items: TaskType[];
  onAddTask: (type: TaskType) => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <>
        {items.map((type) => {
          const Icon = taskTypeIcon(type);
          return (
            <button
              key={type}
              type="button"
              title={t(`taskType.${type}` as 'taskType.COMMAND')}
              onClick={() => onAddTask(type)}
              className="w-9 h-9 rounded-lg border border-white/10 hover:bg-white/5 flex items-center justify-center text-primary"
            >
              <Icon size={16} />
            </button>
          );
        })}
      </>
    );
  }

  return (
    <div className="space-y-1">
      {items.map((type) => {
        const Icon = taskTypeIcon(type);
        return (
          <button
            key={type}
            type="button"
            onClick={() => onAddTask(type)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 hover:border-primary/30 text-left text-sm font-bold transition-all"
          >
            <Icon size={16} className="text-primary shrink-0" />
            <span className="truncate">{t(`taskType.${type}` as 'taskType.COMMAND')}</span>
          </button>
        );
      })}
    </div>
  );
}

export function WorkflowNodePalette({
  onAddDelay,
  onAddCondition,
  onAddTelegram,
  onAddTask,
  onImportChromeScript,
  onImportDesktopRecording,
  onImportTaskTemplate,
  onImportWorkflow,
  onAddChromeStep,
  onAddDesktopStep,
  collapsed,
  chainNextStep,
}: Props) {
  if (collapsed) {
    return (
      <div className="w-12 border-r border-white/5 flex flex-col items-center py-3 gap-2 shrink-0">
        <FlowControlButtons
          onAddDelay={onAddDelay}
          onAddCondition={onAddCondition}
          onAddTelegram={onAddTelegram}
          compact
        />
        <TaskPaletteButtons items={SHELL_TASK_ITEMS} onAddTask={onAddTask} compact />
        <TaskPaletteButtons items={DESKTOP_TASK_ITEMS} onAddTask={onAddTask} compact />
        <WfRecordingStepPalette module="desktop" compact onAddDesktopStep={onAddDesktopStep} />
        <TaskPaletteButtons items={BROWSER_TASK_ITEMS} onAddTask={onAddTask} compact />
        <WfRecordingStepPalette module="chrome" compact onAddChromeStep={onAddChromeStep} />
      </div>
    );
  }

  return (
    <div className="w-52 border-r border-white/5 bg-surface-container-low/30 flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
      <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant px-4 pt-4 pb-2">
        {t('workflows.paletteTitle')}
      </p>
      <p className="text-[9px] text-on-surface-variant/50 px-4 pb-3 leading-snug">
        {chainNextStep ? t('workflows.addNodeChain') : t('workflows.addNodeFree')}
      </p>

      <PaletteSectionLabel label={t('workflows.paletteFlow')} />
      <FlowControlButtons
        onAddDelay={onAddDelay}
        onAddCondition={onAddCondition}
        onAddTelegram={onAddTelegram}
      />

      <PaletteSectionLabel label={t('workflows.paletteShell')} />
      <div className="px-2 pb-1">
        <TaskPaletteButtons items={SHELL_TASK_ITEMS} onAddTask={onAddTask} />
      </div>

      <PaletteSectionLabel label={t('workflows.paletteDesktop')} />
      <div className="px-2 pb-1">
        <TaskPaletteButtons items={DESKTOP_TASK_ITEMS} onAddTask={onAddTask} />
      </div>
      <WfRecordingStepPaletteLabel module="desktop" />
      <div className="px-2 pb-1">
        <WfRecordingStepPalette module="desktop" onAddDesktopStep={onAddDesktopStep} />
      </div>

      <PaletteSectionLabel label={t('workflows.paletteBrowser')} />
      <div className="px-2 pb-1">
        <TaskPaletteButtons items={BROWSER_TASK_ITEMS} onAddTask={onAddTask} />
      </div>
      <WfRecordingStepPaletteLabel module="chrome" />
      <div className="px-2 pb-1">
        <WfRecordingStepPalette module="chrome" onAddChromeStep={onAddChromeStep} />
      </div>

      <PaletteSectionLabel label={t('workflows.paletteLibrary')} />
      <div className="px-2 pb-4">
        <WfImportMenu
          compact
          onImportChromeScript={onImportChromeScript}
          onImportDesktopRecording={onImportDesktopRecording}
          onImportTaskTemplate={onImportTaskTemplate}
          onImportWorkflow={onImportWorkflow}
        />
      </div>
    </div>
  );
}

/** Task types hiển thị trên palette — dùng test hoặc re-export. */
export const WORKFLOW_PALETTE_TASK_TYPES = ALL_TASK_ITEMS;
