import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FileCode,
  Filter,
  Users,
  Loader2,
  Settings2,
  ListTodo,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { AgentCard } from '@/src/components/AgentCard';
import { CommandTemplateForm } from '@/src/components/taskTemplate/CommandTemplateForm';
import { ScriptTemplateForm } from '@/src/components/taskTemplate/ScriptTemplateForm';
import { SystemInfoTemplateForm } from '@/src/components/taskTemplate/SystemInfoTemplateForm';
import { OpenAppTemplateForm } from '@/src/components/taskTemplate/OpenAppTemplateForm';
import { OpenBrowserTemplateForm } from '@/src/components/taskTemplate/OpenBrowserTemplateForm';
import { DesktopAutomationBuilder } from '@/src/components/taskTemplate/DesktopAutomationBuilder';
import { ChromeExtensionBuilder } from '@/src/components/taskTemplate/ChromeExtensionBuilder';
import { ScreenCaptureTemplateForm } from '@/src/components/taskTemplate/ScreenCaptureTemplateForm';
import { HttpRequestTemplateForm } from '@/src/components/taskTemplate/HttpRequestTemplateForm';
import { TaskTemplateWizardShell } from '@/src/components/taskTemplate/wizard/TaskTemplateWizardShell';
import { TaskTemplateWizardFooter } from '@/src/components/taskTemplate/wizard/TaskTemplateWizardFooter';
import { TaskTemplateFilterRow } from '@/src/components/taskTemplate/wizard/TaskTemplateFilterRow';
import type { WizardStepKey } from '@/src/components/taskTemplate/wizard/TaskTemplateWizardSteps';
import { Pagination } from '@/src/components/Pagination';
import { useMediaQuery } from '@/src/hooks/useMediaQuery';
import { useAgentsList } from '@/src/hooks/useAgents';
import { useAgentDetail } from '@/src/hooks/useAgents';
import { useTaskTemplateDetail, useTaskTemplateMutations } from '@/src/hooks/useTaskTemplates';
import { mapAgentToCard } from '@/src/lib/mappers';
import { taskTypeIcon } from '@/src/lib/taskTypeIcons';
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

const AGENT_PAGE_LIMIT = 12;
const CLUSTER_FETCH_LIMIT = 200;

const FILTER_BTN =
  'flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-bold shrink-0';

const TYPE_CARD_BASE =
  'text-left rounded-xl border border-white/5 bg-surface-container-low/40 p-4 transition-all w-full';
const TYPE_CARD_SELECTED = 'border-primary/40 bg-primary/10 ring-1 ring-primary/30';

export default function TaskTemplateEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const templateId = id ?? null;
  const isCompact = !useMediaQuery('(min-width: 1024px)');

  const [step, setStep] = useState<WizardStepKey>(isEdit ? 'meta' : 'agent');
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

  const stepItems = useMemo(
    () => [
      { key: 'agent' as const, label: t('templateWizard.stepAgent'), Icon: Users },
      { key: 'meta' as const, label: t('templateWizard.stepMeta'), Icon: ListTodo },
      { key: 'config' as const, label: t('templateWizard.stepConfig'), Icon: Settings2 },
    ],
    [],
  );

  const pageTitle = isEdit ? t('tasks.editTemplateTitle') : t('tasks.addTemplate');

  const isFlowConfig =
    step === 'config' &&
    (form.type === 'CHROME_EXTENSION' || form.type === 'DESKTOP_AUTOMATION');

  useEffect(() => {
    setPage(1);
  }, [statusFilter, clusterFilter]);

  useEffect(() => {
    if (!template || !isEdit) return;
    const agent = agentDetail ?? template.agent ?? null;
    setForm(parseTemplateToForm(template, agent as Agent | null));
  }, [template, agentDetail, isEdit]);

  const patch = (p: Partial<TemplateEditorState>) => setForm((f) => ({ ...f, ...p }));

  const canGoToStep = (target: WizardStepKey): boolean => {
    if (target === 'agent') return true;
    if (target === 'meta') return Boolean(form.agentId);
    return Boolean(form.agentId && form.name.trim() && form.type);
  };

  const goToStep = (target: WizardStepKey) => {
    if (!canGoToStep(target)) return;
    setStep(target);
    setError('');
  };

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

  const footerBackBtn = (onBack: () => void) => (
    <button
      type="button"
      onClick={onBack}
      className="px-4 sm:px-5 py-2.5 rounded-xl border border-white/10 font-bold text-sm hover:bg-white/5 shrink-0"
    >
      {t('templateWizard.back')}
    </button>
  );

  if (isEdit && templateLoading) {
    return (
      <div className="h-full min-h-[40dvh] flex items-center justify-center text-on-surface-variant">
        <Loader2 className="animate-spin w-10 h-10" />
        <span className="ml-3">{t('templateWizard.loadingTemplate')}</span>
      </div>
    );
  }

  return (
    <TaskTemplateWizardShell
      compact={isCompact}
      title={pageTitle}
      cancelLabel={t('templateWizard.cancel')}
      onCancel={() => navigate('/tasks')}
      steps={stepItems}
      currentStep={step}
      canGoToStep={canGoToStep}
      onStepChange={goToStep}
      agentName={form.agent?.name}
      onChangeAgent={form.agent ? () => goToStep('agent') : undefined}
      changeAgentLabel={t('templateWizard.changeAgent')}
      error={error}
      onClearError={() => setError('')}
      footer={
        step === 'meta' ? (
          <TaskTemplateWizardFooter compact={isCompact}>
            {footerBackBtn(() => goToStep('agent'))}
            <div className="flex-1 min-w-[1rem]" />
            <button
              type="button"
              onClick={goMetaNext}
              className="px-5 sm:px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm shrink-0"
            >
              {t('templateWizard.next')}
            </button>
          </TaskTemplateWizardFooter>
        ) : step === 'config' ? (
          <TaskTemplateWizardFooter compact={isCompact}>
            {footerBackBtn(() => goToStep('meta'))}
            <div className="flex-1 min-w-[1rem]" />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={create.isPending || update.isPending}
              className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm disabled:opacity-50 min-w-[120px] shrink-0"
            >
              {create.isPending || update.isPending ? (
                <Loader2 className="animate-spin w-5 h-5" />
              ) : (
                t('templateWizard.save')
              )}
            </button>
          </TaskTemplateWizardFooter>
        ) : undefined
      }
    >
      <div
        className={cn(
          'flex flex-col min-h-0',
          isFlowConfig
            ? 'flex-1 min-h-[min(58dvh,100%)] lg:min-h-0 -mx-3 lg:mx-0'
            : 'gap-4 lg:flex-1 lg:min-h-0',
        )}
      >
        {step === 'agent' ? (
          <>
            <div className="shrink-0 space-y-3 lg:px-0">
              <div>
                <h3 className="text-base font-bold text-on-surface">{t('templateWizard.selectAgentTitle')}</h3>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  {t('templateWizard.selectAgentSubtitle')}
                </p>
              </div>
              <TaskTemplateFilterRow>
                <button
                  type="button"
                  onClick={() => setStatusFilter((s) => nextStatusFilter(s))}
                  className={FILTER_BTN}
                >
                  <Filter size={16} className="text-on-surface-variant shrink-0" />
                  {t('filters.statusLabel', { value: statusFilterLabel(statusFilter) })}
                </button>
                <button
                  type="button"
                  onClick={() => setClusterFilter((c) => nextClusterFilter(c))}
                  className={FILTER_BTN}
                >
                  <Users size={16} className="text-on-surface-variant shrink-0" />
                  {t('filters.clusterLabel', { value: clusterFilterLabel(clusterFilter) })}
                </button>
              </TaskTemplateFilterRow>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 pb-2">
              {agentsLoading ? (
                <div className="col-span-full flex justify-center py-16">
                  <Loader2 className="animate-spin w-8 h-8 text-on-surface-variant" />
                </div>
              ) : null}
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
              className="shrink-0 pb-2"
            />
          </>
        ) : null}

        {step === 'meta' ? (
          <div className="space-y-6 lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:custom-scrollbar lg:pr-1">
            <div className="rounded-xl border border-white/5 bg-surface-container-low/40 p-4 sm:p-5">
              <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                {t('tasks.templateName')}
              </label>
              <input
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder={t('tasks.templateNamePlaceholder')}
                className="w-full mt-2 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-base sm:text-lg font-bold"
              />
            </div>

            <div>
              <h3 className="text-base font-bold text-on-surface mb-1">{t('templateWizard.pickType')}</h3>
              <p className="text-sm text-on-surface-variant mb-4">{t('templateWizard.pickTypeHint')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {SELECTABLE_TEMPLATE_TYPES.map((taskType) => {
                  const Icon = taskTypeIcon(taskType);
                  const descKey = `taskType.${taskType}_desc` as 'taskType.COMMAND_desc';
                  const winOnly =
                    taskType === 'DESKTOP_AUTOMATION' ||
                    taskType === 'SCREEN_CAPTURE' ||
                    taskType === 'CHROME_EXTENSION';
                  const selected = form.type === taskType;
                  return (
                    <button
                      key={taskType}
                      type="button"
                      onClick={() => patch({ type: taskType })}
                      className={cn(
                        TYPE_CARD_BASE,
                        'hover:border-primary/25 hover:bg-surface-container-low/70',
                        selected && TYPE_CARD_SELECTED,
                      )}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                            selected ? 'bg-primary/15' : 'bg-surface-container-high/80',
                          )}
                        >
                          <Icon size={20} className="text-primary" />
                        </div>
                        <span className="font-bold text-on-surface text-sm text-left">
                          {t(`taskType.${taskType}` as 'taskType.COMMAND')}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant leading-relaxed text-left">
                        {t(descKey)}
                      </p>
                      {winOnly && form.agent && !isWindowsAgent(form.agent.os) ? (
                        <p className="text-[10px] text-amber-400 mt-2 text-left">
                          {taskType === 'SCREEN_CAPTURE'
                            ? t('screenCapture.windowsOnly')
                            : taskType === 'CHROME_EXTENSION'
                              ? t('workflows.chromeExtensionBanner')
                              : t('templateWizard.desktopWindowsOnly')}
                        </p>
                      ) : null}
                    </button>
                  );
                })}
                <div className={cn(TYPE_CARD_BASE, 'opacity-40 cursor-not-allowed border-dashed')}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-surface-container-high/50 flex items-center justify-center shrink-0">
                      <FileCode size={20} className="text-on-surface-variant" />
                    </div>
                    <span className="font-bold text-on-surface text-sm">{t('taskType.FILE_OPERATION')}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant text-left">{t('taskType.FILE_OPERATION_desc')}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {step === 'config' ? (
          <div
            className={cn(
              'flex-1 min-h-0 flex flex-col',
              !isFlowConfig && 'overflow-y-auto custom-scrollbar lg:pr-1',
            )}
          >
            {form.type === 'CHROME_EXTENSION' || form.type === 'DESKTOP_AUTOMATION' ? (
              form.type === 'CHROME_EXTENSION' ? (
                <ChromeExtensionBuilder state={form} onChange={patch} compact={isCompact} />
              ) : (
                <DesktopAutomationBuilder state={form} onChange={patch} compact={isCompact} />
              )
            ) : (
              <div
                className={cn(
                  form.type === 'HTTP_REQUEST'
                    ? 'bg-transparent'
                    : 'rounded-xl border border-white/5 bg-surface-container-low/40 p-4 sm:p-5',
                )}
              >
                {form.type === 'COMMAND' ? (
                  <CommandTemplateForm state={form} onChange={patch} />
                ) : form.type === 'SCRIPT' ? (
                  <ScriptTemplateForm state={form} onChange={patch} />
                ) : form.type === 'SYSTEM_INFO' ? (
                  <SystemInfoTemplateForm state={form} onChange={patch} />
                ) : form.type === 'OPEN_APP' ? (
                  <OpenAppTemplateForm state={form} onChange={patch} />
                ) : form.type === 'OPEN_BROWSER' ? (
                  <OpenBrowserTemplateForm state={form} onChange={patch} />
                ) : form.type === 'SCREEN_CAPTURE' ? (
                  <ScreenCaptureTemplateForm form={form} patch={patch} />
                ) : form.type === 'HTTP_REQUEST' ? (
                  <HttpRequestTemplateForm state={form} onChange={patch} />
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </TaskTemplateWizardShell>
  );
}
