import { useRef, useEffect } from 'react';
import {
  MoreVertical,
  Pencil,
  Trash2,
  UserX,
  UserCheck,
} from 'lucide-react';
import { t } from '@/src/i18n/t';

export type SettingsUserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'Active' | 'Disabled';
  lastSession: string;
  avatar: string;
};

type Props = {
  user: SettingsUserRow;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
};

export function SettingsUserRowMenu({
  user,
  open,
  onToggle,
  onClose,
  onEdit,
  onToggleActive,
  onDelete,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, onClose]);

  return (
    <div className="relative shrink-0" ref={open ? menuRef : undefined}>
      <button
        type="button"
        onClick={onToggle}
        className="p-2 hover:bg-white/5 rounded-xl transition-all text-on-surface-variant hover:text-primary"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <MoreVertical size={20} />
      </button>
      {open ? (
        <div className="absolute right-0 top-full mt-1 z-30 min-w-[11rem] glass-card rounded-xl border border-white/10 py-1 shadow-2xl">
          <button
            type="button"
            onClick={onEdit}
            className="w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2 hover:bg-white/5"
          >
            <Pencil size={14} /> {t('common.edit')}
          </button>
          <button
            type="button"
            onClick={onToggleActive}
            className="w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2 hover:bg-white/5"
          >
            {user.status === 'Active' ? <UserX size={14} /> : <UserCheck size={14} />}
            {user.status === 'Active' ? t('settings.deactivate') : t('settings.activate')}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2 hover:bg-error/10 text-error"
          >
            <Trash2 size={14} /> {t('common.delete')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
