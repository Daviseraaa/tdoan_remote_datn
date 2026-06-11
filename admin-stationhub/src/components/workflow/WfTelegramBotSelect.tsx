import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import * as triggersApi from '@/src/api/triggers';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';

const selectCls =
  'w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm';

type Props = {
  value: string;
  onChange: (botId: string) => void;
  className?: string;
  /** Chọn bot đầu tiên khi chưa có giá trị (giống TriggerFormModal). */
  autoSelectFirst?: boolean;
};

export function WfTelegramBotSelect({
  value,
  onChange,
  className,
  autoSelectFirst = true,
}: Props) {
  const { data: bots, isLoading } = useQuery({
    queryKey: ['telegram-bots'],
    queryFn: () => triggersApi.listTelegramBots(),
  });

  useEffect(() => {
    if (!autoSelectFirst || value || !bots?.length) return;
    onChange(bots[0]!.id);
  }, [autoSelectFirst, value, bots, onChange]);

  const list = bots ?? [];
  const valueMissingFromList = Boolean(value && !list.some((b) => b.id === value));

  return (
    <div className={className}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
        className={cn(selectCls, !value && 'text-on-surface-variant')}
      >
        <option value="">{isLoading ? '…' : t('triggers.noBotsShort')}</option>
        {valueMissingFromList ? (
          <option value={value}>{value}</option>
        ) : null}
        {list.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
            {b.botUsername ? ` (@${b.botUsername})` : ''}
          </option>
        ))}
      </select>
      {!isLoading && list.length === 0 ? (
        <p className="text-[10px] text-on-surface-variant mt-1.5">
          {t('workflows.telegramBotsEmpty')}{' '}
          <Link to="/bots" className="text-primary font-semibold underline hover:no-underline">
            {t('nav.bots')}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
