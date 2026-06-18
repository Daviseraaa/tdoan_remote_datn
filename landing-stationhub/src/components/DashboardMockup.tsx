import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Copy,
  Grid,
  LayoutDashboard,
  ListTodo,
  Monitor,
  PanelLeft,
  Plus,
  RotateCw,
  Share,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { Logo } from './Logo';
import { t } from '@/src/i18n/t';

const RECENT = [
  { name: 'landing.mockRecent1' as const },
  { name: 'landing.mockRecent2' as const },
  { name: 'landing.mockRecent3' as const },
];

const CARDS = ['landing.mockCard1', 'landing.mockCard2', 'landing.mockCard3'] as const;

const TABLE_ROWS = [
  {
    question: 'landing.mockRow1Q' as const,
    volume: '1.2k',
    difficulty: 'Thấp',
    status: 'landing.mockStatusRunning' as const,
    statusColor: 'text-[#febc2e]/80',
  },
  {
    question: 'landing.mockRow2Q' as const,
    volume: '840',
    difficulty: 'Trung bình',
    status: 'landing.mockStatusQueued' as const,
    statusColor: 'text-white/50',
  },
  {
    question: 'landing.mockRow3Q' as const,
    volume: '2.1k',
    difficulty: 'Thấp',
    status: 'landing.mockStatusRunning' as const,
    statusColor: 'text-[#febc2e]/80',
  },
  {
    question: 'landing.mockRow4Q' as const,
    volume: '560',
    difficulty: 'Cao',
    status: 'landing.mockStatusDone' as const,
    statusColor: 'text-[#28c840]/80',
  },
  {
    question: 'landing.mockRow5Q' as const,
    volume: '3.4k',
    difficulty: 'Trung bình',
    status: 'landing.mockStatusQueued' as const,
    statusColor: 'text-white/50',
  },
];

const STATS = [
  { label: 'landing.mockStat1Label' as const, value: '24', sub: 'landing.mockStat1Sub' as const },
  { label: 'landing.mockStat2Label' as const, value: '18', sub: 'landing.mockStat2Sub' as const },
  { label: 'landing.mockStat3Label' as const, value: '7', sub: 'landing.mockStat3Sub' as const },
  { label: 'landing.mockStat4Label' as const, value: '1,284', sub: 'landing.mockStat4Sub' as const },
];

const SIDEBAR_NAV = [
  { icon: LayoutDashboard, label: 'landing.mockNavDashboard' as const },
  { icon: Bot, label: 'landing.mockNavAgents' as const },
  { icon: Workflow, label: 'landing.mockNavWorkflows' as const },
  { icon: ListTodo, label: 'landing.mockNavTasks' as const },
];

export function DashboardMockup() {
  return (
    <div className="rounded-t-2xl overflow-hidden bg-[#1a1a1c] shadow-[0_-20px_80px_rgba(0,0,0,0.35)] ring-1 ring-white/10 text-left">
      <div className="bg-[#242427] border-b border-white/5 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <PanelLeft className="w-3.5 h-3.5 text-white/40" />
          <ChevronLeft className="w-3.5 h-3.5 text-white/25" />
          <ChevronRight className="w-3.5 h-3.5 text-white/25" />
        </div>
        <div className="flex-1 flex justify-center min-w-0">
          <div className="flex items-center gap-1.5 bg-[#1a1a1c] rounded-md px-6 py-1 text-[10px] text-white/60 max-w-xs w-full justify-center">
            <Monitor className="w-3 h-3 shrink-0" />
            <span className="truncate">stationhub.io</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <RotateCw className="w-3.5 h-3.5 text-white/40" />
          <Share className="w-3.5 h-3.5 text-white/40" />
          <Plus className="w-3.5 h-3.5 text-white/40" />
          <Copy className="w-3.5 h-3.5 text-white/40" />
        </div>
      </div>

      <div className="flex min-h-[320px]">
        <aside className="w-[22%] shrink-0 border-r border-white/5 bg-[#1e1e21] px-3 py-3.5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Logo className="w-4 h-4 text-white/70" />
            <Grid className="w-3.5 h-3.5 text-white/30" />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-[#00d1ff] flex items-center justify-center text-[8px] font-bold text-[#003543]">
              S
            </span>
            <span className="text-[10px] text-white/80 truncate">{t('landing.mockWorkspace')}</span>
          </div>
          <nav className="flex flex-col gap-1.5">
            {SIDEBAR_NAV.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-[10px] text-white/60">
                <Icon className="w-3 h-3 shrink-0" />
                <span className="truncate">{t(label)}</span>
              </div>
            ))}
          </nav>
          <div className="mt-auto pt-2 border-t border-white/5">
            <p className="text-[8px] uppercase tracking-wider text-white/30 mb-2">
              {t('landing.mockRecentTitle')}
            </p>
            <ul className="space-y-1.5">
              {RECENT.map(({ name }) => (
                <li key={name} className="flex items-center gap-1.5 text-[9px] text-white/55">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#28c840]/70 shrink-0" />
                  <span className="truncate">{t(name)}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="flex-1 min-w-0 p-4 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-lg bg-[#00d1ff] flex items-center justify-center text-sm font-bold text-[#003543] shrink-0">
                S
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{t('landing.mockWorkspace')}</p>
                <p className="text-[10px] text-white/45 truncate">{t('landing.mockWorkspaceSub')}</p>
              </div>
            </div>
            <button
              type="button"
              className="flex items-center gap-1.5 shrink-0 rounded-lg bg-white/10 px-2.5 py-1.5 text-[10px] text-white/80 ring-1 ring-white/10"
            >
              <Sparkles className="w-3 h-3" />
              {t('landing.mockGenerate')}
            </button>
          </div>

          <div className="grid grid-cols-4 divide-x divide-white/5 rounded-xl bg-white/[0.03] ring-1 ring-white/5">
            {STATS.map(({ label, value, sub }) => (
              <div key={label} className="px-3 py-2.5">
                <p className="text-[8px] tracking-wider text-white/35 uppercase">{t(label)}</p>
                <p className="text-xl font-medium text-white mt-0.5">{value}</p>
                <p className="text-[9px] text-white/35 mt-0.5">{t(sub)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {CARDS.map((card) => (
              <div
                key={card}
                className="rounded-lg bg-white/[0.03] ring-1 ring-white/5 px-2.5 py-2 text-[10px] text-white/70"
              >
                {t(card)}
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-white/[0.02] ring-1 ring-white/5 overflow-hidden flex-1">
            <div className="grid grid-cols-[1fr_48px_64px_72px] gap-2 px-2.5 py-1.5 border-b border-white/5 text-[8px] uppercase tracking-wider text-white/30">
              <span>{t('landing.mockColTask')}</span>
              <span className="text-right">{t('landing.mockColAgents')}</span>
              <span className="text-right">{t('landing.mockColPriority')}</span>
              <span className="text-right">{t('landing.mockColStatus')}</span>
            </div>
            {TABLE_ROWS.map((row) => (
              <div
                key={row.question}
                className="grid grid-cols-[1fr_48px_64px_72px] gap-2 px-2.5 py-1.5 border-b border-white/5 last:border-b-0 text-[9px]"
              >
                <span className="text-white/65 truncate">{t(row.question)}</span>
                <span className="text-white/40 text-right">{row.volume}</span>
                <span className="text-white/40 text-right">{row.difficulty}</span>
                <span className={`text-right ${row.statusColor}`}>{t(row.status)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
