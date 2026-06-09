import React, { useEffect, useMemo, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { AlertTriangle, Braces, LayoutList } from 'lucide-react';
import {
  type TemplateEditorState,
  DESKTOP_STEPS_MAX,
  desktopStepsToPayload,
  isWindowsAgent,
} from '@/src/lib/taskTemplatePayload';
import {
  desktopStepsDocumentText,
  parseDesktopStepsDocument,
} from '@/src/lib/desktopRecordingSteps';
import { t } from '@/src/i18n/t';
import { TemplateAdvancedFields } from './TemplateAdvancedFields';
import { TemplateBuilderModeBar } from './wizard/TemplateBuilderModeBar';
import { DesktopAutomationFlowCanvas } from './DesktopAutomationFlowCanvas';

type EditMode = 'visual' | 'json';

type Props = {
  state: TemplateEditorState;
  onChange: (patch: Partial<TemplateEditorState>) => void;
  compact?: boolean;
};

export function DesktopAutomationBuilder({ state, onChange, compact }: Props) {
  const [editMode, setEditMode] = useState<EditMode>('visual');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const steps = state.desktopSteps;
  const showWinWarn = state.agent && !isWindowsAgent(state.agent.os);

  const previewJson = useMemo(
    () => JSON.stringify(desktopStepsToPayload(steps), null, 2),
    [steps],
  );

  useEffect(() => {
    if (editMode === 'json') {
      setJsonText(desktopStepsDocumentText(steps));
      setJsonError('');
    }
  }, [editMode, steps]);

  const applyJson = () => {
    const result = parseDesktopStepsDocument(jsonText);
    if ('error' in result) {
      setJsonError(result.error);
      return;
    }
    if (result.steps.length > DESKTOP_STEPS_MAX) {
      setJsonError(t('templateWizard.desktopStepsMax', { max: String(DESKTOP_STEPS_MAX) }));
      return;
    }
    setJsonError('');
    onChange({ desktopSteps: result.steps });
    setEditMode('visual');
  };

  return (
    <div className="min-h-0 flex flex-col gap-3 h-full lg:min-h-0">
      {showWinWarn ? (
        <div className="shrink-0 flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <p>{t('templateWizard.desktopWindowsOnly')}</p>
        </div>
      ) : (
        <div className="shrink-0 flex items-start gap-3 p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-on-surface-variant">
          <AlertTriangle size={16} className="shrink-0 text-primary mt-0.5" />
          <p>{t('templateWizard.desktopBanner')}</p>
        </div>
      )}

      <TemplateBuilderModeBar
        compact={compact}
        modes={[
          {
            id: 'visual',
            label: t('templateWizard.desktopEditVisual'),
            Icon: LayoutList,
            active: editMode === 'visual',
            onClick: () => setEditMode('visual'),
          },
          {
            id: 'json',
            label: t('templateWizard.desktopEditJson'),
            Icon: Braces,
            active: editMode === 'json',
            onClick: () => setEditMode('json'),
          },
        ]}
      />

      {editMode === 'json' ? (
        <div className="flex-1 min-h-0 glass-card rounded-2xl p-4 border border-white/5 flex flex-col">
          <p className="text-sm text-on-surface-variant mb-3 shrink-0">{t('templateWizard.desktopJsonHint')}</p>
          <textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setJsonError('');
            }}
            spellCheck={false}
            className="flex-1 min-h-[240px] w-full px-4 py-3 rounded-xl bg-[#0b0f14] border border-white/10 font-mono text-xs text-[#d4d4d4] custom-scrollbar resize-none"
            placeholder={'{\n  "steps": [\n    { "action": "delay", "ms": 500 }\n  ]\n}'}
          />
          {jsonError ? <p className="mt-2 text-xs text-error shrink-0">{jsonError}</p> : null}
          <div className="flex flex-wrap gap-2 mt-4 shrink-0">
            <button
              type="button"
              onClick={applyJson}
              className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold"
            >
              {t('templateWizard.desktopJsonApply')}
            </button>
            <button
              type="button"
              onClick={() => setJsonText(desktopStepsDocumentText(steps))}
              className="px-4 py-2 rounded-xl border border-white/10 text-xs font-bold text-on-surface-variant hover:text-on-surface"
            >
              {t('templateWizard.desktopJsonReset')}
            </button>
          </div>
          <details className="mt-4 shrink-0">
            <summary className="text-[10px] font-mono font-bold uppercase text-on-surface-variant cursor-pointer">
              {t('templateWizard.desktopPreview')}
            </summary>
            <pre className="mt-2 text-[10px] font-mono bg-[#0b0f14] p-3 rounded-lg border border-white/10 max-h-32 overflow-auto text-[#d4d4d4]">
              {previewJson}
            </pre>
          </details>
          <div className="mt-4 shrink-0">
            <TemplateAdvancedFields
              timeout={state.timeout}
              priority={state.priority}
              onChange={(p) => onChange(p)}
            />
          </div>
        </div>
      ) : (
        <ReactFlowProvider>
          <DesktopAutomationFlowCanvas
            compact={compact}
            steps={steps}
            onStepsChange={(desktopSteps) => onChange({ desktopSteps })}
            inspectorFooter={
              <TemplateAdvancedFields
                timeout={state.timeout}
                priority={state.priority}
                onChange={(p) => onChange(p)}
              />
            }
          />
        </ReactFlowProvider>
      )}
    </div>
  );
}
