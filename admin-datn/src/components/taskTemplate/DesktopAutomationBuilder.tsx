import React, { useMemo, useState } from 'react';
import {
  Clock,
  AppWindow,
  Move,
  MousePointer2,
  Keyboard,
  Command,
  ScrollText,
  GripVertical,
  Trash2,
  Plus,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  type DesktopAction,
  type DesktopStep,
  type TemplateEditorState,
  desktopStepsToPayload,
  isWindowsAgent,
  newDesktopStep,
  summarizeDesktopStep,
} from '@/src/lib/taskTemplatePayload';
import { t } from '@/src/i18n/t';
import { TemplateAdvancedFields } from './TemplateAdvancedFields';

const PALETTE: { action: DesktopAction; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { action: 'delay', icon: Clock },
  { action: 'openApp', icon: AppWindow },
  { action: 'move', icon: Move },
  { action: 'click', icon: MousePointer2 },
  { action: 'typeText', icon: Keyboard },
  { action: 'keyCombo', icon: Command },
  { action: 'scroll', icon: ScrollText },
];

type Props = {
  state: TemplateEditorState;
  onChange: (patch: Partial<TemplateEditorState>) => void;
};

function actionLabel(action: DesktopAction): string {
  return t(`templateWizard.desktopAction_${action}` as 'templateWizard.desktopAction_delay');
}

export function DesktopAutomationBuilder({ state, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const steps = state.desktopSteps;
  const selected = steps.find((s) => s.id === selectedId) ?? null;
  const showWinWarn = state.agent && !isWindowsAgent(state.agent.os);

  const previewJson = useMemo(
    () => JSON.stringify(desktopStepsToPayload(steps), null, 2),
    [steps],
  );

  const updateSteps = (next: DesktopStep[]) => {
    onChange({ desktopSteps: next });
    if (selectedId && !next.some((s) => s.id === selectedId)) setSelectedId(null);
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
    <div className="space-y-4">
      {showWinWarn ? (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <p>{t('templateWizard.desktopWindowsOnly')}</p>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/10 border border-primary/20 text-sm text-on-surface-variant">
          <AlertTriangle size={18} className="shrink-0 text-primary mt-0.5" />
          <p>{t('templateWizard.desktopBanner')}</p>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr_280px] gap-4 min-h-[420px]">
        {/* Palette */}
        <div className="glass-card rounded-2xl p-4 border border-white/5">
          <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-3">
            {t('templateWizard.desktopPalette')}
          </p>
          <div className="space-y-2">
            {PALETTE.map(({ action, icon: Icon }) => (
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
            ))}
          </div>
        </div>

        {/* Flow */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col">
          <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-4">
            {t('templateWizard.desktopFlow')}
          </p>
          {steps.length === 0 ? (
            <p className="text-sm text-on-surface-variant flex-1 flex items-center justify-center text-center py-12">
              {t('templateWizard.desktopEmpty')}
            </p>
          ) : (
            <div className="flex flex-col items-center gap-0 flex-1 overflow-y-auto custom-scrollbar py-2">
              {steps.map((step, idx) => {
                const Icon = PALETTE.find((p) => p.action === step.action)?.icon ?? Clock;
                return (
                  <React.Fragment key={step.id}>
                    <div
                      draggable
                      onDragStart={() => onDragStart(step.id)}
                      onDragEnd={() => setDragId(null)}
                      onDragOver={(e) => onDragOver(e, step.id)}
                      onClick={() => setSelectedId(step.id)}
                      className={cn(
                        'w-full max-w-md flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all',
                        selectedId === step.id
                          ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/20'
                          : 'border-white/10 bg-surface-container-low/50 hover:border-white/20',
                      )}
                    >
                      <GripVertical size={16} className="text-on-surface-variant/40 shrink-0 cursor-grab" />
                      <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0">
                        <Icon size={20} className="text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono text-on-surface-variant uppercase">
                          {actionLabel(step.action)}
                        </p>
                        <p className="text-sm font-bold text-on-surface truncate">
                          {summarizeDesktopStep(step)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeStep(step.id);
                        }}
                        className="p-2 rounded-lg hover:bg-error/20 text-error shrink-0"
                        title={t('templateWizard.desktopDeleteStep')}
                      >
                        <Trash2 size={16} />
                      </button>
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
          )}
        </div>

        {/* Properties */}
        <div className="glass-card rounded-2xl p-4 border border-white/5">
          <p className="text-[10px] font-mono font-bold uppercase text-on-surface-variant mb-3">
            {t('templateWizard.desktopProps')}
          </p>
          {!selected ? (
            <p className="text-xs text-on-surface-variant">—</p>
          ) : (
            <DesktopStepFields step={selected} onChange={(patch) => updateStep(selected.id, patch)} />
          )}
          <details className="mt-6">
            <summary className="text-[10px] font-mono font-bold uppercase text-on-surface-variant cursor-pointer">
              {t('templateWizard.desktopPreview')}
            </summary>
            <pre className="mt-2 text-[10px] font-mono bg-[#0b0f14] p-3 rounded-lg border border-white/10 max-h-40 overflow-auto text-[#d4d4d4]">
              {previewJson}
            </pre>
          </details>
        </div>
      </div>

      <TemplateAdvancedFields
        timeout={state.timeout}
        priority={state.priority}
        onChange={(p) => onChange(p)}
      />
    </div>
  );
}

function DesktopStepFields({
  step,
  onChange,
}: {
  step: DesktopStep;
  onChange: (patch: Partial<DesktopStep>) => void;
}) {
  const field = (labelKey: keyof typeof import('@/src/i18n/vi').vi.templateWizard, el: React.ReactNode) => (
    <div className="mb-3">
      <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant block mb-1">
        {t(labelKey as 'templateWizard.field_ms')}
      </label>
      {el}
    </div>
  );

  const inputCls =
    'w-full px-3 py-2 rounded-lg bg-surface-container-low border border-white/10 text-sm';

  switch (step.action) {
    case 'delay':
      return field(
        'field_ms',
        <input
          type="number"
          min={0}
          value={step.ms ?? 0}
          onChange={(e) => onChange({ ms: Number(e.target.value) })}
          className={inputCls}
        />,
      );
    case 'openApp':
      return field(
        'field_target',
        <input
          value={step.target ?? ''}
          onChange={(e) => onChange({ target: e.target.value })}
          className={inputCls}
        />,
      );
    case 'move':
      return (
        <>
          {field(
            'field_x',
            <input
              type="number"
              value={step.x ?? 0}
              onChange={(e) => onChange({ x: Number(e.target.value) })}
              className={inputCls}
            />,
          )}
          {field(
            'field_y',
            <input
              type="number"
              value={step.y ?? 0}
              onChange={(e) => onChange({ y: Number(e.target.value) })}
              className={inputCls}
            />,
          )}
        </>
      );
    case 'click':
      return (
        <>
          {field(
            'field_x',
            <input
              type="number"
              value={step.x ?? ''}
              placeholder="—"
              onChange={(e) =>
                onChange({ x: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              className={inputCls}
            />,
          )}
          {field(
            'field_y',
            <input
              type="number"
              value={step.y ?? ''}
              placeholder="—"
              onChange={(e) =>
                onChange({ y: e.target.value === '' ? undefined : Number(e.target.value) })
              }
              className={inputCls}
            />,
          )}
          {field(
            'field_button',
            <select
              value={step.button ?? 'left'}
              onChange={(e) => onChange({ button: e.target.value as 'left' | 'right' })}
              className={inputCls}
            >
              <option value="left">left</option>
              <option value="right">right</option>
            </select>,
          )}
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(step.double)}
              onChange={(e) => onChange({ double: e.target.checked })}
            />
            {t('templateWizard.field_double')}
          </label>
        </>
      );
    case 'typeText':
      return field(
        'field_text',
        <textarea
          value={step.text ?? ''}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={4}
          className={inputCls}
        />,
      );
    case 'keyCombo':
      return field(
        'field_keys',
        <input
          value={step.keys ?? ''}
          onChange={(e) => onChange({ keys: e.target.value })}
          className={inputCls}
        />,
      );
    case 'scroll':
      return (
        <>
          {field(
            'field_direction',
            <select
              value={step.direction ?? 'down'}
              onChange={(e) =>
                onChange({ direction: e.target.value as DesktopStep['direction'] })
              }
              className={inputCls}
            >
              <option value="up">up</option>
              <option value="down">down</option>
              <option value="left">left</option>
              <option value="right">right</option>
            </select>,
          )}
          {field(
            'field_amount',
            <input
              type="number"
              min={1}
              value={step.amount ?? 3}
              onChange={(e) => onChange({ amount: Number(e.target.value) })}
              className={inputCls}
            />,
          )}
        </>
      );
    default:
      return null;
  }
}
