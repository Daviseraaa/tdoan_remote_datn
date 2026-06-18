import type { ReactNode } from 'react';
import { GitBranch } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import { formatStepVar, formatTelegramVar, TELEGRAM_TRIGGER_VAR_KEYS } from '@/src/lib/workflowGraph';
import type { UpstreamOutputKey } from '@/src/lib/workflowGraph';
import { WfInspectorSubsection } from './WfInspectorLayout';
import { WfCopyRefButton } from './WfCopyRefButton';

type Props = {
  upstream?: UpstreamOutputKey[];
  workflowVarKeys?: string[];
  /** Hiện chip copy {{telegram.*}} khi workflow trigger là Telegram. */
  showTelegramVars?: boolean;
  className?: string;
};

function UpstreamVarCard({
  label,
  stepKey,
}: {
  label: string;
  stepKey: string;
}) {
  const stdout = formatStepVar(stepKey, 'stdout');
  const exitCode = formatStepVar(stepKey, 'exitCode');

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] to-transparent p-3 space-y-2.5">
      <div className="flex items-start gap-2 min-w-0">
        <div className="shrink-0 mt-0.5 p-1.5 rounded-lg bg-primary/15 text-primary">
          <GitBranch size={12} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold text-on-surface truncate" title={label}>
            {label}
          </p>
          <p className="text-[9px] font-mono text-primary/80 truncate mt-0.5">{stepKey}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <WfCopyRefButton refText={stdout} label="stdout" tone="primary" />
        <WfCopyRefButton refText={exitCode} label="exitCode" tone="neutral" />
      </div>
    </div>
  );
}

/** Copy nhanh biến workflow + từ node trước — đặt đầu panel. */
export function WfStepVarsSection({
  upstream = [],
  workflowVarKeys = [],
  showTelegramVars = false,
  className,
}: Props) {
  const hasWorkflowCopy = workflowVarKeys.length > 0;

  return (
    <div className={cn('space-y-3', className)}>
      {showTelegramVars ? (
        <WfInspectorSubsection
          title={t('workflows.varsTelegram')}
          tone="telegram"
          empty={false}
        >
          <div className="flex flex-wrap gap-1.5">
            {TELEGRAM_TRIGGER_VAR_KEYS.map((k) => (
              <WfCopyRefButton
                key={k}
                refText={formatTelegramVar(k)}
                label={`telegram.${k}`}
                tone="neutral"
              />
            ))}
          </div>
        </WfInspectorSubsection>
      ) : null}

      <WfInspectorSubsection
        title={t('workflows.workflowVariables')}
        tone="workflow"
        empty={!hasWorkflowCopy}
      >
        {hasWorkflowCopy ? (
          <div className="flex flex-wrap gap-1.5">
            {workflowVarKeys.map((k) => (
              <WfCopyRefButton
                key={k}
                refText={`{{workflow.${k}}}`}
                label={`workflow.${k}`}
                tone="sky"
              />
            ))}
          </div>
        ) : null}
      </WfInspectorSubsection>

      <WfInspectorSubsection
        title={t('workflows.varsUpstream')}
        tone="upstream"
        empty={upstream.length === 0}
      >
        {upstream.length > 0 ? (
          <div className="space-y-2">
            {upstream.map((u) => (
              <UpstreamVarCard key={u.nodeId} label={u.label} stepKey={u.key} />
            ))}
          </div>
        ) : null}
      </WfInspectorSubsection>
    </div>
  );
}
