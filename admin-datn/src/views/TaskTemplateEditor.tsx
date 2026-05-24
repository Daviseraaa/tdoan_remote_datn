import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Terminal,
  FileCode,
  Info,
  AppWindow,
  Globe,
  MousePointer2,
  Filter,
  Users,
  AlertCircle,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { AgentCard } from '@/src/components/AgentCard';
import { CommandTemplateForm } from '@/src/components/taskTemplate/CommandTemplateForm';
import { ScriptTemplateForm } from '@/src/components/taskTemplate/ScriptTemplateForm';
import { SystemInfoTemplateForm } from '@/src/components/taskTemplate/SystemInfoTemplateForm';
import { OpenAppTemplateForm } from '@/src/components/taskTemplate/OpenAppTemplateForm';
import { DesktopAutomationBuilder } from '@/src/components/taskTemplate/DesktopAutomationBuilder';
import { Pagination } from '@/src/components/Pagination';
import { useAgentsList } from '@/src/hooks/useAgents';
import { useAgentDetail } from '@/src/hooks/useAgents';
import { useTaskTemplateDetail, useTaskTemplateMutations } from '@/src/hooks/useTaskTemplates';
import { mapAgentToCard } from '@/src/lib/mappers';
import {
  clusterFilterLabel,
  filterAgentsByCluster,
  nextClusterFilter,
  nextStatusFilter,
  statusFilterLabel,
  type AgentClusterFilter,
  type AgentStatusFilter,
} from '@/src/lib/agentFilters';
import {
  DEFAULT_TEMPLATE_STATE,
  SELECTABLE_TEMPLATE_TYPES,
  buildTemplateDto,
  isWindowsAgent,
  parseTemplateToForm,
  validateTemplateState,
  type TemplateEditorState,
} from '@/src/lib/taskTemplatePayload';
import { apiErrorMessage } from '@/src/lib/api';
import { t } from '@/src/i18n/t';
import type { Agent, TaskType } from '@/src/types/api';

type WizardStep = 'agent' | 'meta' | 'config';

const TYPE_ICONS: Record<TaskType, React.ComponentType<{ size?: number; className?: string }>> = {
  COMMAND: Terminal,
  SCRIPT: FileCode,
  FILE_OPERATION: FileCode,
  SYSTEM_INFO: Info,
  OPEN_APP: AppWindow,
  OPEN_BROWSER: Globe,
  DESKTOP_AUTOMATION: MousePointer2,
};

const AGENT_PAGE_LIMIT = 12;
const CLUSTER_FETCH_LIMIT = 200;

export default function TaskTemplateEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const templateId = id ?? null;

  const [step, setStep] = useState<WizardStep>(isEdit ? 'meta' : 'agent');
  const [form, setForm] = useState<TemplateEditorState>(DEFAULT_TEMPLATE_STATE);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<AgentStatusFilter>('all');
  const [clusterFilter, setClusterFilter] = useState<AgentClusterFilter>('all');

  const { data: template, isLoading: templateLoading } = useTaskTemplateDetail(templateId);
  const { data: agentDetail } = useAgentDetail(form.agentId || undefined);
  const { create, update } = useTaskTemplateMutations();

  const useClusterClientPaging = clusterFilter !== 'all';
  const { data: agentsPage, isLoading: agentsLoading } = useAgentsList({
    page: useClusterClientPaging ? 1 : page,
    limit: useClusterClientPaging ? CLUSTER_FETCH_LIMIT : AGENT_PAGE_LIMIT,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
  });

  const filteredRaw = useMemo(
    () => filterAgentsByCluster(agentsPage?.items ?? [], clusterFilter),
    [agentsPage?.items, clusterFilter],
  );

  const displayAgents = useMemo(() => {
    if (!useClusterClientPaging) return filteredRaw;
    const start = (page - 1) * AGENT_PAGE_LIMIT;
    return filteredRaw.slice(start, start + AGENT_PAGE_LIMIT);
  }, [filteredRaw, useClusterClientPaging, page]);

  const displayTotal = useClusterClientPaging ? filteredRaw.length : (agentsPage?.meta.total ?? 0);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, clusterFilter]);

  useEffect(() => {
    if (!template || !isEdit) return;
    const agent = agentDetail ?? template.agent ?? null;
    setForm(parseTemplateToForm(template, agent as Agent | null));
  }, [template, agentDetail, isEdit]);

  const patch = (p: Partial<TemplateEditorState>) => setForm((f) => ({ ...f, ...p }));

  const handleSelectAgent = (agent: Agent) => {
    patch({ agentId: agent.id, agent });
    setStep('meta');
    setError('');
  };

  const handleSave = async () => {
    setError('');
    const err = validateTemplateState(form);
    if (err) {
      setError(err);
      return;
    }
    const dto = buildTemplateDto(form);
    try {
      if (isEdit && templateId) {
        await update.mutateAsync({ id: templateId, dto });
      } else {
        await create.mutateAsync(dto);
      }
      navigate('/tasks');
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const goMetaNext = () => {
    setError('');
    if (!form.name.trim()) {
      setError(t('tasks.templateNameRequired'));
      return;
    }
    if (!form.type) {
      setError(t('templateWizard.typeRequired'));
      return;
    }
    setStep('config');
  };

  const stepLabels: { key: WizardStep; label: string }[] = [
    { key: 'agent', label: t('templateWizard.stepAgent') },
    { key: 'meta', label: t('templateWizard.stepMeta') },
    { key: 'config', label: t('templateWizard.stepConfig') },
  ];

  if (isEdit && templateLoading) {
    return (
      <div className="flex justify-center py-24 text-on-surface-variant">
        <Loader2 className="animate-spin w-10 h-10" />
        <span className="ml-3">{t('templateWizard.loadingTemplate')}</span>
      </div>
    );
  }

  return (
    <div className="pb-20 min-w-0">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/tasks')}
            className="flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-primary mb-4"
          >
            <ArrowLeft size={16} />
            {t('templateWizard.cancel')}
          </button>
          <h2 className="text-4xl font-bold tracking-tight text-on-surface">
            {isEdit ? t('templateWizard.editTitle') : t('templateWizard.createTitle')}
          </h2>
        </div>
        {form.agent ? (
          <div className="glass-card px-4 py-2 rounded-xl border border-white/10 text-sm">
            <span className="text-on-surface-variant font-mono text-[10px] uppercase mr-2">Agent</span>
            <span className="font-bold text-on-surface">{form.agent.name}</span>
            <button
              type="button"
              onClick={() => setStep('agent')}
              className="ml-3 text-primary text-xs font-bold hover:underline"
            >
              {t('templateWizard.changeAgent')}
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex gap-2 mb-8">
        {stepLabels.map((s, i) => (
          <div
            key={s.key}
            className={cn(
              'flex-1 py-2 px-3 rounded-xl text-center text-xs font-bold border',
              step === s.key
                ? 'bg-primary/20 border-primary/40 text-primary'
                : 'border-white/10 text-on-surface-variant',
            )}
          >
            {i + 1}. {s.label}
          </div>
        ))}
      </div>

      {error ? (
        <div className="mb-6 flex items-center gap-2 p-4 rounded-xl bg-error-container/20 border border-error/30 text-error text-sm">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      ) : null}

      {step === 'agent' ? (
        <>
          <div className="mb-6">
            <h3 className="text-xl font-bold text-on-surface">{t('templateWizard.selectAgentTitle')}</h3>
            <p className="text-on-surface-variant text-sm mt-1">{t('templateWizard.selectAgentSubtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-3 mb-6 justify-end">
            <button
              type="button"
              onClick={() => setStatusFilter((s) => nextStatusFilter(s))}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-bold"
            >
              <Filter size={16} className="text-on-surface-variant" />
              {t('filters.statusLabel', { value: statusFilterLabel(statusFilter) })}
            </button>
            <button
              type="button"
              onClick={() => setClusterFilter((c) => nextClusterFilter(c))}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-bold"
            >
              <Users size={16} className="text-on-surface-variant" />
              {t('filters.clusterLabel', { value: clusterFilterLabel(clusterFilter) })}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {agentsLoading && (
              <p className="text-on-surface-variant col-span-3">{t('agents.loading')}</p>
            )}
            {!agentsLoading &&
              displayAgents.map((agent) => {
                const card = mapAgentToCard(agent);
                return (
                  <AgentCard
                    key={agent.id}
                    {...card}
                    actionLabel={t('templateWizard.select')}
                    selected={form.agentId === agent.id}
                    onClick={() => handleSelectAgent(agent)}
                  />
                );
              })}
          </div>
          <Pagination
            page={page}
            limit={AGENT_PAGE_LIMIT}
            total={displayTotal}
            onPageChange={setPage}
            className="mt-8"
          />
        </>
      ) : null}

      {step === 'meta' ? (
        <div className="max-w-3xl space-y-8">
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('tasks.templateName')}
            </label>
            <input
              value={form.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder={t('tasks.templateNamePlaceholder')}
              className="w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-lg font-bold"
            />
          </div>
          <div>
            <h3 className="text-lg font-bold text-on-surface mb-1">{t('templateWizard.pickType')}</h3>
            <p className="text-sm text-on-surface-variant mb-4">{t('templateWizard.pickTypeHint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SELECTABLE_TEMPLATE_TYPES.map((taskType) => {
                const Icon = TYPE_ICONS[taskType];
                const descKey = `taskType.${taskType}_desc` as 'taskType.COMMAND_desc';
                const winOnly = taskType === 'DESKTOP_AUTOMATION';
                return (
                  <button
                    key={taskType}
                    type="button"
                    onClick={() => patch({ type: taskType })}
                    className={cn(
                      'text-left p-5 rounded-2xl border transition-all',
                      form.type === taskType
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'border-white/10 hover:border-white/20 bg-surface-container-low/30',
                    )}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Icon size={22} className="text-primary" />
                      <span className="font-bold text-on-surface">{t(`taskType.${taskType}` as 'taskType.COMMAND')}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant">{t(descKey)}</p>
                    {winOnly && form.agent && !isWindowsAgent(form.agent.os) ? (
                      <p className="text-[10px] text-amber-400 mt-2">{t('templateWizard.desktopWindowsOnly')}</p>
                    ) : null}
                  </button>
                );
              })}
              <div className="p-5 rounded-2xl border border-white/5 opacity-40 cursor-not-allowed">
                <div className="flex items-center gap-3 mb-2">
                  <FileCode size={22} />
                  <span className="font-bold">{t('taskType.FILE_OPERATION')}</span>
                </div>
                <p className="text-xs text-on-surface-variant">{t('taskType.FILE_OPERATION_desc')}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('agent')}
              className="px-6 py-3 rounded-xl border border-white/10 font-bold"
            >
              {t('templateWizard.back')}
            </button>
            <button
              type="button"
              onClick={goMetaNext}
              className="px-8 py-3 rounded-xl bg-primary text-on-primary font-bold"
            >
              {t('templateWizard.next')}
            </button>
          </div>
        </div>
      ) : null}

      {step === 'config' ? (
        <div className="space-y-6">
          {form.type === 'COMMAND' ? (
            <CommandTemplateForm state={form} onChange={patch} />
          ) : form.type === 'SCRIPT' ? (
            <ScriptTemplateForm state={form} onChange={patch} />
          ) : form.type === 'SYSTEM_INFO' ? (
            <SystemInfoTemplateForm state={form} onChange={patch} />
          ) : form.type === 'OPEN_APP' ? (
            <OpenAppTemplateForm state={form} onChange={patch} />
          ) : form.type === 'OPEN_BROWSER' ? (
            <CommandTemplateForm state={form} onChange={patch} />
          ) : form.type === 'DESKTOP_AUTOMATION' ? (
            <DesktopAutomationBuilder state={form} onChange={patch} />
          ) : null}

          <div className="flex flex-wrap gap-3 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={() => setStep('meta')}
              className="px-6 py-3 rounded-xl border border-white/10 font-bold"
            >
              {t('templateWizard.back')}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={create.isPending || update.isPending}
              className="px-8 py-3 rounded-xl bg-primary text-on-primary font-bold disabled:opacity-50"
            >
              {create.isPending || update.isPending ? (
                <Loader2 className="animate-spin inline w-5 h-5" />
              ) : (
                t('templateWizard.save')
              )}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
