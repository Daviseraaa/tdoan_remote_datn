import React, { useMemo, useState } from 'react';
import {
  AppWindow,
  Clock,
  Command,
  GripVertical,
  Keyboard,
  MousePointer2,
  Move,
  Plus,
  ScrollText,
  Trash2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import {
  actionLabel,
  DESKTOP_STEP_PALETTE,
  newDesktopStep,
  stepsToJson,
  summarizeStep,
  type DesktopAction,
  type DesktopStep,
} from '@/src/lib/desktopRecordingSteps';
import { DesktopStepInspector } from './DesktopStepInspector';

const ICONS: Record<
  DesktopAction,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  delay: Clock,
  openApp: AppWindow,
  move: Move,
  click: MousePointer2,
  typeText: Keyboard,
  keyCombo: Command,
  scroll: ScrollText,
};

const FLOW_SCROLL_MAX = 'max-h-[min(calc(100vh-14rem),720px)]';

type Props = {
  steps: DesktopStep[];
  onChange: (steps: DesktopStep[]) => void;
  readOnly?: boolean;
};

export function DesktopRecordingStepBuilder({ steps, onChange, readOnly = false }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const selected = steps.find((s) => s.id === selectedId) ?? null;

  const previewJson = useMemo(
    () => JSON.stringify(stepsToJson(steps), null, 2),
    [steps],
  );

  const updateSteps = (next: DesktopStep[]) => {
    onChange(next);
    if (selectedId && !next.some((s) => s.id === selectedId)) {
      setSelectedId(null);
    }
  };

  const addStep = (action: DesktopAction) => {
    const step = newDesktopStep(action);
    updateSteps([...steps, step]);
    setSelectedId(step.id);
  };

  const updateStep = (id: string, patch: Partial<DesktopStep>) => {
    updateSteps(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeStep = (id: string) => {
    updateSteps(steps.filter((s) => s.id !== id));
  };

  const onDragStart = (id: string) => setDragId(id);
  const onDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    if (!dragId || dragId === overId) return;
    const from = steps.findIndex((s) => s.id === dragId);
    const to = steps.findIndex((s) => s.id === overId);
    if (from < 0 || to < 0) return;
    const next = [...steps];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    updateSteps(next);
  };

  return (
    <div
      className={cn(
        'grid grid-cols-1 xl:grid-cols-[200px_1fr_280px] gap-4 items-stretch',
        FLOW_SCROLL_MAX,
      )}
    >
      {!readOnly ? (
      <div className="glass-card rounded-2xl p-4 border border-white/5">
        <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-3">
          {t('desktopRecordings.palette')}
        </p>
        <div className="space-y-2">
          {DESKTOP_STEP_PALETTE.map((action) => {
            const Icon = ICONS[action];
            return (
              <button
                key={action}
                type="button"
                onClick={() => addStep(action)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 hover:border-primary/30 text-left text-sm font-bold transition-all"
              >
                <Icon size={16} className="text-primary shrink-0" />
                <span className="truncate">{actionLabel(action)}</span>
                <Plus size={14} className="ml-auto opacity-50" />
              </button>
            );
          })}
        </div>
      </div>
      ) : null}

      <div
        className={cn(
          'glass-card rounded-2xl p-6 border border-white/5 flex flex-col min-h-0 overflow-hidden',
          readOnly && 'xl:col-span-2',
        )}
      >
        <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-4 shrink-0">
          {t('desktopRecordings.flow')}
        </p>
        {steps.length === 0 ? (
          <p className="text-sm text-on-surface-variant flex-1 flex items-center justify-center text-center py-12">
            {t('desktopRecordings.stepEmpty')}
          </p>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar py-2">
            <div className="flex flex-col items-center gap-0">
            {steps.map((step, idx) => {
              const Icon = ICONS[step.action];
              return (
                <React.Fragment key={step.id}>
                  <div
                    draggable={!readOnly}
                    onDragStart={() => !readOnly && onDragStart(step.id)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e) => !readOnly && onDragOver(e, step.id)}
                    onClick={() => setSelectedId(step.id)}
                    className={cn(
                      'w-full max-w-md flex items-center gap-3 p-4 rounded-2xl border transition-all',
                      readOnly ? 'cursor-default' : 'cursor-pointer',
                      selectedId === step.id
                        ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/20'
                        : 'border-white/10 bg-surface-container-low/50 hover:border-white/20',
                    )}
                  >
                    {!readOnly ? (
                    <GripVertical size={16} className="text-on-surface-variant/40 shrink-0 cursor-grab" />
                    ) : null}
                    <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0">
                      <Icon size={20} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-mono text-on-surface-variant uppercase">
                        {actionLabel(step.action)}
                      </p>
                      <p className="text-sm font-bold text-on-surface truncate">
                        {summarizeStep(step)}
                      </p>
                    </div>
                    {!readOnly ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeStep(step.id);
                      }}
                      className="p-2 rounded-lg hover:bg-error/20 text-error shrink-0"
                      title={t('desktopRecordings.deleteStep')}
                    >
                      <Trash2 size={16} />
                    </button>
                    ) : null}
                  </div>
                  {idx < steps.length - 1 ? (
                    <div className="flex flex-col items-center py-1 text-on-surface-variant/30">
                      <div className="w-px h-4 bg-white/20" />
                      <span className="text-lg leading-none">↓</span>
                      <div className="w-px h-4 bg-white/20" />
                    </div>
                  ) : null}
                </React.Fragment>
              );
            })}
            </div>
          </div>
        )}
      </div>

      <div
        className={cn(
          'glass-card rounded-2xl p-4 border border-white/5 flex flex-col min-h-0 overflow-hidden',
          FLOW_SCROLL_MAX,
        )}
      >
        <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-3">
          {t('desktopRecordings.inspector')}
        </p>
        <DesktopStepInspector
          step={selected}
          readOnly={readOnly}
          onChange={(patch) => {
            if (selected && !readOnly) updateStep(selected.id, patch);
          }}
        />
        <details className="mt-auto pt-4">
          <summary className="text-[10px] font-mono font-bold uppercase text-on-surface-variant cursor-pointer">
            {t('desktopRecordings.jsonPreview')}
          </summary>
          <pre className="mt-2 text-[10px] font-mono bg-[#0b0f14] p-3 rounded-lg border border-white/10 max-h-40 overflow-auto text-[#d4d4d4]">
            {previewJson}
          </pre>
        </details>
      </div>
    </div>
  );
}
