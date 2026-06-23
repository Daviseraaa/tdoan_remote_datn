import type { Agent, WorkflowExcelMode } from '@/src/types/api';
import { workflowVarNameInputValue } from '@/src/lib/workflowGraph';
import { t } from '@/src/i18n/t';
import { WfAgentSelect } from './WfAgentSelect';

const inputCls =
  'w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 font-mono text-sm';

type Props = {
  mode: WorkflowExcelMode;
  agentId?: string;
  agents: Agent[];
  filePath?: string;
  sheetName?: string;
  hasHeader?: boolean;
  variableName?: string;
  variableValue?: string;
  onAgentChange: (agentId: string) => void;
  onPatch: (patch: {
    filePath?: string;
    sheetName?: string;
    hasHeader?: boolean;
    variableName?: string;
    variableValue?: string;
  }) => void;
};

export function WfExcelConfigFields({
  mode,
  agentId,
  agents,
  filePath,
  sheetName,
  hasHeader,
  variableName,
  variableValue,
  onAgentChange,
  onPatch,
}: Props) {
  const isRead = mode === 'read';
  const varDisplay = workflowVarNameInputValue('excel', variableName);
  const resolvedVarName = variableName?.trim() || 'excel_data';

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-on-surface-variant/80">
        {isRead ? t('workflows.excelReadHint') : t('workflows.excelWriteHint')}
      </p>

      <WfAgentSelect
        agents={agents}
        value={agentId ?? ''}
        onChange={onAgentChange}
      />

      <div>
        <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
          {t('workflows.excelFilePath')}
        </label>
        <input
          value={filePath ?? ''}
          onChange={(e) => onPatch({ filePath: e.target.value.trim() || undefined })}
          className={inputCls}
          placeholder="C:\\data\\report.xlsx"
        />
      </div>

      <div>
        <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
          {t('workflows.excelSheet')}
        </label>
        <input
          value={!sheetName?.trim() || sheetName.trim() === 'Sheet1' ? '' : sheetName}
          onChange={(e) => onPatch({ sheetName: e.target.value.trim() || undefined })}
          placeholder="Sheet1"
          className={inputCls}
        />
      </div>

      {isRead ? (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasHeader !== false}
            onChange={(e) => onPatch({ hasHeader: e.target.checked })}
            className="rounded border-white/20"
          />
          {t('workflows.excelHasHeader')}
        </label>
      ) : (
        <>
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('workflows.variableName')}
            </label>
            <input
              value={varDisplay}
              onChange={(e) => onPatch({ variableName: e.target.value.trim() || undefined })}
              placeholder="excel_data"
              className={inputCls}
            />
            <p className="text-[10px] text-on-surface-variant/70 mt-1">
              {t('workflows.excelWriteVarHint', { var: resolvedVarName })}
            </p>
          </div>
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('workflows.variableValue')}
            </label>
            <textarea
              value={variableValue ?? ''}
              onChange={(e) => onPatch({ variableValue: e.target.value })}
              rows={2}
              placeholder="{{workflow.excel_data}}"
              className={inputCls}
            />
            <p className="text-[10px] text-on-surface-variant/70 mt-1">
              {t('workflows.variableValueHint')}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
