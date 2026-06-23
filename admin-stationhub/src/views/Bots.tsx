import { AlertTriangle, Bot, Info } from 'lucide-react';
import { TelegramBotsPanel } from '@/src/components/automations/TelegramBotsPanel';
import { t } from '@/src/i18n/t';

export default function Bots() {
  return (
    <div className="pb-12 min-w-0 max-w-full space-y-6">
      <header className="mb-2 sm:mb-4">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="w-10 h-10 rounded-xl bg-sky-400/15 flex items-center justify-center shrink-0">
            <Bot size={22} className="text-sky-400" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">
            {t('botsPage.title')}
          </h2>
        </div>
        <p className="prose-description text-on-surface-variant text-sm max-w-2xl">
          {t('botsPage.subtitle')}
        </p>
      </header>

      <div className="glass-card rounded-2xl p-5 sm:p-6 border border-tertiary/20 bg-tertiary/5">
        <div className="flex items-start gap-3">
          <Info className="text-tertiary shrink-0" size={22} />
          <p className="text-sm text-on-surface-variant leading-relaxed">{t('botsPage.hint')}</p>
        </div>
      </div>

      <div className="rounded-2xl p-5 sm:p-6 border border-amber-400/25 bg-amber-400/5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-amber-400 shrink-0" size={22} />
          <p className="text-sm text-amber-400/95 leading-relaxed">{t('botsPage.securityWarning')}</p>
        </div>
      </div>

      <TelegramBotsPanel hideTitle />
    </div>
  );
}
