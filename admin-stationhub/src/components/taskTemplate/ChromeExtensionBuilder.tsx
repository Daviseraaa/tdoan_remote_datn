import React, { useEffect, useMemo, useState } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { AlertTriangle, Braces, LayoutList } from 'lucide-react';
import {
  CHROME_STEPS_MAX,
  type TemplateEditorState,
} from '@/src/lib/taskTemplatePayload';
import {
  chromeStepsDocumentText,
  parseChromeStepsDocument,
  stepsToJson,
} from '@/src/lib/chromeScriptSteps';
import { t } from '@/src/i18n/t';
import { TemplateAdvancedFields } from './TemplateAdvancedFields';
import { TemplateBuilderModeBar } from './wizard/TemplateBuilderModeBar';
import { ChromeExtensionFlowCanvas } from './ChromeExtensionFlowCanvas';

type EditMode = 'visual' | 'json';

type Props = {
  state: TemplateEditorState;
  onChange: (patch: Partial<TemplateEditorState>) => void;
  compact?: boolean;
};

export function ChromeExtensionBuilder({ state, onChange, compact }: Props) {
  const [editMode, setEditMode] = useState<EditMode>('visual');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const steps = state.chromeSteps;

  const previewJson = useMemo(
    () =>
      JSON.stringify(
        {
          steps: stepsToJson(steps),
          ...(state.chromeUrlPattern.trim()
            ? { urlPattern: state.chromeUrlPattern.trim() }
            : {}),
        },
        null,
        2,
      ),
    [steps, state.chromeUrlPattern],
  );

  useEffect(() => {
    if (editMode === 'json') {
      setJsonText(chromeStepsDocumentText(steps, state.chromeUrlPattern));
      setJsonError('');
    }
  }, [editMode, steps, state.chromeUrlPattern]);

  const applyJson = () => {
    const result = parseChromeStepsDocument(jsonText);
    if ('error' in result) {
      setJsonError(result.error);
      return;
    }
    if (result.steps.length > CHROME_STEPS_MAX) {
      setJsonError(t('templateWizard.chromeStepsMax', { max: String(CHROME_STEPS_MAX) }));
      return;
    }
    let urlPattern = state.chromeUrlPattern;
    try {
      const parsed = JSON.parse(jsonText.trim()) as { urlPattern?: string };
      if (typeof parsed.urlPattern === 'string') {
        urlPattern = parsed.urlPattern;
      }
    } catch {
      /* steps already validated */
    }
    setJsonError('');
    onChange({ chromeSteps: result.steps, chromeUrlPattern: urlPattern });
    setEditMode('visual');
  };

  return (
    <div className="min-h-0 flex flex-col gap-3 h-full lg:min-h-0">
      <div className="shrink-0 flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <p>{t('workflows.chromeExtensionBanner')}</p>
      </div>

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
          <p className="text-sm text-on-surface-variant mb-3 shrink-0">{t('templateWizard.chromeJsonHint')}</p>
          <textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setJsonError('');
            }}
            spellCheck={false}
            className="flex-1 min-h-[240px] w-full px-4 py-3 rounded-xl bg-[#0b0f14] border border-white/10 font-mono text-xs text-[#d4d4d4] custom-scrollbar resize-none"
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
              onClick={() =>
                setJsonText(chromeStepsDocumentText(steps, state.chromeUrlPattern))
              }
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
          <ChromeExtensionFlowCanvas
            compact={compact}
            steps={steps}
            urlPattern={state.chromeUrlPattern}
            onStepsChange={(chromeSteps) => onChange({ chromeSteps })}
            onUrlPatternChange={(chromeUrlPattern) => onChange({ chromeUrlPattern })}
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
