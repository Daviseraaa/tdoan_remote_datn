import {
  Pencil,
  Trash2,
  UserX,
  UserCheck,
  CalendarPlus,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';

export type SettingsUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Disabled';
  lastSession: string;
  avatar: string;
  subscriptionLabel?: string;
  subscriptionStatus?: string;
  subscriptionStatusRaw?: string;
  subscriptionPlan?: string;
  subscriptionExpires?: string;
};

type Props = {
  user: SettingsUserRow;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onExtendSubscription?: () => void;
  className?: string;
};

const iconBtn =
  'p-1.5 rounded-md transition-colors text-on-surface-variant hover:text-on-surface hover:bg-white/5 disabled:opacity-40';

export function SettingsUserRowMenu({
  user,
  onEdit,
  onToggleActive,
  onDelete,
  onExtendSubscription,
  className,
}: Props) {
  return (
    <div className={cn('flex items-center justify-end gap-0.5 shrink-0', className)}>
      <button
        type="button"
        onClick={onEdit}
        className={cn(iconBtn, 'hover:text-primary')}
        title={t('common.edit')}
        aria-label={t('common.edit')}
      >
        <Pencil size={16} />
      </button>
      {onExtendSubscription ? (
        <button
          type="button"
          onClick={onExtendSubscription}
          className={cn(iconBtn, 'hover:text-primary')}
          title={t('settings.extendSubscription')}
          aria-label={t('settings.extendSubscription')}
        >
          <CalendarPlus size={16} />
        </button>
      ) : null}
      <button
        type="button"
        onClick={onToggleActive}
        className={cn(
          iconBtn,
          user.status === 'Active' ? 'hover:text-amber-400' : 'hover:text-tertiary',
        )}
        title={user.status === 'Active' ? t('settings.deactivate') : t('settings.activate')}
        aria-label={user.status === 'Active' ? t('settings.deactivate') : t('settings.activate')}
      >
        {user.status === 'Active' ? <UserX size={16} /> : <UserCheck size={16} />}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className={cn(iconBtn, 'hover:text-error hover:bg-error/10')}
        title={t('common.delete')}
        aria-label={t('common.delete')}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
