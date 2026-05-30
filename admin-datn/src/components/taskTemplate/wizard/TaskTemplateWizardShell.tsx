import type { ReactNode } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { TaskTemplateWizardHeader } from './TaskTemplateWizardHeader';
import {
  TaskTemplateWizardSteps,
  type WizardStepItem,
  type WizardStepKey,
} from './TaskTemplateWizardSteps';

type Props = {
  compact?: boolean;
  title: string;
  cancelLabel: string;
  onCancel: () => void;
  steps: WizardStepItem[];
  currentStep: WizardStepKey;
  canGoToStep: (key: WizardStepKey) => boolean;
  onStepChange: (key: WizardStepKey) => void;
  agentName?: string;
  onChangeAgent?: () => void;
  changeAgentLabel?: string;
  error?: string;
  onClearError?: () => void;
  footer?: ReactNode;
  children: ReactNode;
};

export function TaskTemplateWizardShell({
  compact,
  title,
  cancelLabel,
  onCancel,
  steps,
  currentStep,
  canGoToStep,
  onStepChange,
  agentName,
  onChangeAgent,
  changeAgentLabel,
  error,
  onClearError,
  footer,
  children,
}: Props) {
  return (
    <div className="h-full min-h-0 w-full flex flex-col overflow-hidden bg-surface-container-lowest">
      <TaskTemplateWizardHeader compact={compact} title={title} cancelLabel={cancelLabel} onCancel={onCancel} />

      <TaskTemplateWizardSteps
        compact={compact}
        steps={steps}
        current={currentStep}
        canGoTo={canGoToStep}
        onSelect={onStepChange}
        agentName={agentName}
        onChangeAgent={onChangeAgent}
        changeAgentLabel={changeAgentLabel}
      />

      {error ? (
        <div className="shrink-0 mx-3 mt-2 flex items-center gap-2 p-3 rounded-xl bg-error-container/20 border border-error/30 text-error text-sm">
          <AlertCircle size={16} className="shrink-0" />
          <span className="flex-1 min-w-0">{error}</span>
          {onClearError ? (
            <button type="button" onClick={onClearError} className="p-1 hover:bg-white/5 rounded shrink-0">
              <X size={14} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar px-3 py-3 lg:px-4 lg:py-4 lg:overflow-hidden lg:flex lg:flex-col">
        {children}
      </div>

      {footer ?? null}
    </div>
  );
}
