import type { DesktopRecording, TaskTemplate } from '@/src/types/api';
import { t } from '@/src/i18n/t';
import { WfImportMenu } from './WfImportMenu';

const inputCls =
  'w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-xs';

type Props = {
  command?: string;
  payload?: unknown;
  onPatch: (patch: { command?: string; payload?: Record<string, unknown> }) => void;
  onImportDesktopRecording?: (recording: DesktopRecording) => void;
  onImportTaskTemplate?: (template: TaskTemplate) => void;
};

export function WfDesktopAutomationConfigFields({
  command,
  payload,
  onPatch,
  onImportDesktopRecording,
  onImportTaskTemplate,
}: Props) {
  const payloadJson = JSON.stringify(
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : { steps: [] },
    null,
    2,
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-amber-400/90 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2.5">
        {t('workflows.desktopAutomationGuide')}
      </p>
      <WfImportMenu
        compact
        sources={['task', 'desktopRecording']}
        onImportChromeScript={() => {}}
        onImportDesktopRecording={(rec) => onImportDesktopRecording?.(rec)}
        onImportTaskTemplate={(tpl) => onImportTaskTemplate?.(tpl)}
        onImportWorkflow={() => {}}
      />
      <details className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">
        <summary className="text-[10px] font-mono font-bold uppercase text-on-surface-variant cursor-pointer">
          {t('workflows.desktopAutomationJsonAdvanced')}
        </summary>
        <p className="text-[10px] text-on-surface-variant mt-2 mb-2">
          {t('workflows.desktopStepsHint')}
        </p>
        <textarea
          value={command?.trim() ? command : payloadJson}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (!raw) {
              onPatch({ command: '', payload: { steps: [] } });
              return;
            }
            if (raw.startsWith('[') || raw.startsWith('{')) {
              try {
                const parsed = JSON.parse(raw) as unknown;
                if (Array.isArray(parsed)) {
                  onPatch({ command: raw, payload: { steps: parsed } });
                } else if (
                  parsed &&
                  typeof parsed === 'object' &&
                  Array.isArray((parsed as { steps?: unknown[] }).steps)
                ) {
                  onPatch({
                    command: raw,
                    payload: parsed as Record<string, unknown>,
                  });
                } else {
                  onPatch({ command: raw });
                }
              } catch {
                onPatch({ command: raw });
              }
            } else {
              onPatch({ command: raw });
            }
          }}
          rows={8}
          placeholder={t('workflows.desktopStepsHint')}
          className={inputCls}
        />
      </details>
    </div>
  );
}
