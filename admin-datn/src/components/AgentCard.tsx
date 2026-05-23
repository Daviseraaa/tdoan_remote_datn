import React from 'react';
import {
  ArrowRight,
  Clock,
  Cpu,
  Database,
  Globe,
  Monitor,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';

export type AgentCardProps = {
  name: string;
  status: 'ONLINE' | 'BUSY' | 'OFFLINE' | 'IDLE';
  hostname: string;
  os: string;
  ip: string;
  activeTask: string;
  cpuPercent: number;
  cpuLabel: string;
  showCpuBar: boolean;
  ramPercent: number;
  ramLabel: string;
  showRamBar: boolean;
  lastSeen: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  onClick: () => void;
  /** Nhãn CTA góc phải khi hover (mặc định: Quản lý) */
  actionLabel?: string;
  selected?: boolean;
};

export function AgentCard({
  name,
  status,
  hostname,
  os,
  ip,
  activeTask,
  cpuPercent,
  cpuLabel,
  showCpuBar,
  ramPercent,
  ramLabel,
  showRamBar,
  lastSeen,
  icon: Icon,
  onClick,
  actionLabel,
  selected,
}: AgentCardProps) {
  const cta = actionLabel ?? t('agents.manage');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      onClick={onClick}
      className={cn(
        'glass-card p-6 rounded-2xl group cursor-pointer transition-all duration-300 border relative overflow-hidden flex flex-col h-full shadow-lg hover:shadow-primary/5',
        selected
          ? 'border-primary/50 ring-2 ring-primary/30'
          : 'border-white/5 hover:border-primary/40',
      )}
    >
      <motion.div className="flex justify-between items-start mb-6">
        <motion.div className="flex gap-4 min-w-0">
          <motion.div className="w-14 h-14 shrink-0 rounded-2xl bg-surface-container-highest flex items-center justify-center text-on-surface-variant group-hover:text-primary transition-colors ring-1 ring-white/5 group-hover:ring-primary/20 shadow-inner">
            <Icon size={28} />
          </motion.div>
          <motion.div className="space-y-1 min-w-0">
            <h4 className="text-xl font-bold text-on-surface group-hover:text-primary transition-colors leading-tight truncate">
              {name}
            </h4>
            <p className="text-[11px] font-mono text-on-surface-variant/60 truncate" title={hostname}>
              {hostname}
            </p>
          </motion.div>
        </motion.div>
        <motion.div
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 border',
            status === 'ONLINE'
              ? 'bg-tertiary/10 text-tertiary border-tertiary/20'
              : status === 'BUSY'
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-white/5 text-on-surface-variant border-white/10',
          )}
        >
          <motion.div
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              status === 'ONLINE'
                ? 'bg-tertiary shadow-[0_0_8px_#68f5b8]'
                : status === 'BUSY'
                  ? 'bg-primary animate-pulse shadow-[0_0_8px_#a4e6ff]'
                  : 'bg-on-surface-variant/40',
            )}
          />
          {t(`status.${status}` as 'status.ONLINE')}
        </motion.div>
      </motion.div>

      <div className="space-y-4 flex-1">
        <motion.div className="flex justify-between items-center text-xs">
          <span className="text-on-surface-variant/70 font-medium">{t('agents.activeTask')}</span>
          <span
            className={cn(
              'font-bold py-1 px-2 rounded-lg border text-[10px] uppercase tracking-wider',
              activeTask === t('common.yes')
                ? 'bg-primary/10 text-primary border-primary/20'
                : 'bg-white/5 text-on-surface-variant/60 border-white/10',
            )}
          >
            {activeTask}
          </span>
        </motion.div>

        <motion.div className="grid grid-cols-2 gap-4">
          <motion.div className="space-y-1">
            <motion.div className="flex items-center gap-1.5 opacity-60">
              <Cpu size={12} className="text-primary" />
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest">{t('common.cpu')}</span>
            </motion.div>
            <motion.div className="text-sm font-bold text-on-surface font-mono">{cpuLabel}</motion.div>
            {showCpuBar ? (
              <motion.div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    cpuPercent > 80 ? 'bg-error' : cpuPercent > 50 ? 'bg-primary' : 'bg-tertiary',
                  )}
                  style={{ width: `${cpuPercent}%` }}
                />
              </motion.div>
            ) : null}
          </motion.div>
          <motion.div className="space-y-1">
            <motion.div className="flex items-center gap-1.5 opacity-60">
              <Database size={12} className="text-tertiary" />
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest">{t('common.ram')}</span>
            </motion.div>
            <motion.div className="text-sm font-bold text-on-surface font-mono">{ramLabel}</motion.div>
            {showRamBar ? (
              <motion.div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-tertiary rounded-full transition-all duration-500"
                  style={{ width: `${ramPercent}%` }}
                />
              </motion.div>
            ) : null}
          </motion.div>
        </motion.div>

        <motion.div className="grid grid-cols-2 gap-4 py-2 border-y border-white/5">
          <motion.div className="space-y-1 min-w-0">
            <motion.div className="flex items-center gap-1.5 opacity-60">
              <Monitor size={12} className="text-primary" />
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest">{t('common.os')}</span>
            </motion.div>
            <motion.div className="text-sm font-medium text-on-surface truncate" title={os}>
              {os}
            </motion.div>
          </motion.div>
          <motion.div className="space-y-1 min-w-0">
            <motion.div className="flex items-center gap-1.5 opacity-60">
              <Globe size={12} className="text-tertiary" />
              <span className="text-[9px] font-mono font-bold uppercase tracking-widest">{t('common.ip')}</span>
            </motion.div>
            <motion.div className="text-sm font-medium text-on-surface font-mono truncate" title={ip}>
              {ip}
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      <motion.div className="mt-6 pt-5 border-t border-white/5 flex justify-between items-center text-[10px] font-mono tracking-[0.1em] text-on-surface-variant/50">
        <motion.div className="flex items-center gap-2 min-w-0">
          <Clock size={12} className="opacity-60 shrink-0" />
          <span className="truncate">
            <span className="uppercase tracking-wider text-on-surface-variant/40 mr-1.5">{t('time.lastSeen')}</span>
            {lastSeen}
          </span>
        </motion.div>
        <motion.div className="flex items-center gap-1.5 text-primary font-bold opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0 shrink-0">
          <span>{cta}</span>
          <ArrowRight size={12} />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
