import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  ChevronRight,
  ShieldCheck,
  History,
  Shield,
  Key,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Pagination } from '@/src/components/Pagination';
import {
  SettingsUserRowMenu,
  type SettingsUserRow,
} from '@/src/components/settings/SettingsUserRowMenu';
import { useUsersList, useUserMutations } from '@/src/hooks/useUsers';
import { mapUserToTableRow } from '@/src/lib/mappers';
import { apiErrorMessage } from '@/src/lib/api';
import { t } from '@/src/i18n/t';
import * as billingApi from '@/src/api/billing';

const PAGE_LIMIT = 20;

type ExtendMode = 'add_days' | 'pick_datetime';

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultManualExpiry(
  subscriptionExpiresAt?: string | null,
  addDays = 30,
): string {
  const base = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : new Date();
  const start = new Date(Math.max(base.getTime(), Date.now()));
  start.setDate(start.getDate() + addDays);
  return toDatetimeLocalValue(start);
}

const MODAL_SHELL =
  'fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm';
const MODAL_PANEL =
  'glass-card w-full sm:max-w-md border border-white/10 rounded-t-2xl sm:rounded-2xl p-4 sm:p-8 space-y-4 max-h-[min(90dvh,640px)] overflow-y-auto custom-scrollbar pb-[max(1rem,env(safe-area-inset-bottom,0px))]';

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={cn(
        'inline-flex px-2 py-1 rounded-lg text-[9px] font-bold tracking-widest shrink-0',
        role === 'ADMIN'
          ? 'bg-primary-container/10 text-primary border border-primary/20'
          : 'bg-white/5 text-on-surface-variant border border-white/10',
      )}
    >
      {t(`status.${role}` as 'status.ADMIN' | 'status.USER')}
    </span>
  );
}

function UserIdentity({ user }: { user: SettingsUserRow }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="relative shrink-0">
        <img
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-surface-container-highest border border-white/10 p-0.5 object-cover"
          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatar}`}
          alt={user.name}
        />
        {user.status === 'Active' ? (
          <div className="absolute -bottom-1 -right-1 w-3 h-3 sm:w-3.5 sm:h-3.5 bg-tertiary rounded-full border-2 border-surface shadow-[0_0_8px_#68f5b8]" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm text-on-surface truncate">{user.name}</div>
        <div className="text-xs text-on-surface-variant font-mono lowercase truncate opacity-70">
          {user.email}
        </div>
      </div>
    </div>
  );
}

type UserListProps = {
  users: SettingsUserRow[];
  isLoading: boolean;
  onEdit: (user: SettingsUserRow) => void;
  onToggleActive: (id: string) => void;
  onDelete: (id: string) => void;
  onExtendSubscription: (user: SettingsUserRow) => void;
};

function SettingsUserList({
  users,
  isLoading,
  onEdit,
  onToggleActive,
  onDelete,
  onExtendSubscription,
}: UserListProps) {
  return (
    <>
      <ul className="lg:hidden divide-y divide-white/5">
        {isLoading ? (
          <li className="px-4 py-8 text-sm text-on-surface-variant">{t('settings.loadingUsers')}</li>
        ) : null}
        {!isLoading &&
          users.map((user) => (
            <li
              key={user.id}
              className={cn(
                'p-4 space-y-3',
                user.status === 'Disabled' && 'opacity-50 grayscale',
              )}
            >
              <UserIdentity user={user} />
              <div className="flex flex-wrap items-center gap-2 pl-[52px]">
                <RoleBadge role={user.role} />
                <span
                  className={cn(
                    'text-xs font-bold',
                    user.status === 'Active' ? 'text-tertiary' : 'text-on-surface-variant opacity-60',
                  )}
                >
                  {user.status === 'Active' ? t('common.active') : t('common.disabled')}
                </span>
              </div>
              <SettingsUserRowMenu
                user={user}
                className="pl-[52px] justify-start"
                onEdit={() => onEdit(user)}
                onToggleActive={() => void onToggleActive(user.id)}
                onDelete={() => onDelete(user.id)}
                onExtendSubscription={() => onExtendSubscription(user)}
              />
              <p className="text-[11px] font-mono text-on-surface-variant opacity-80 pl-[52px]">
                {t('settings.subscription')}: {user.subscriptionLabel}
              </p>
              <p className="text-[11px] font-mono text-on-surface-variant opacity-80 pl-[52px]">
                {t('settings.lastSession')}: {user.lastSession}
              </p>
            </li>
          ))}
      </ul>

      <div className="hidden lg:block overflow-x-auto overflow-y-visible">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/[0.01] border-b border-white/5">
              <th className="px-6 xl:px-8 py-4 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-on-surface-variant opacity-60">
                {t('settings.identity')}
              </th>
              <th className="px-6 xl:px-8 py-4 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-on-surface-variant opacity-60">
                {t('settings.accessRole')}
              </th>
              <th className="px-6 xl:px-8 py-4 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-on-surface-variant opacity-60">
                {t('common.status')}
              </th>
              <th className="px-6 xl:px-8 py-4 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-on-surface-variant opacity-60">
                {t('settings.subscription')}
              </th>
              <th className="px-6 xl:px-8 py-4 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-on-surface-variant opacity-60">
                {t('settings.lastSession')}
              </th>
              <th className="px-6 xl:px-8 py-4 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-on-surface-variant opacity-60 text-right">
                {t('settings.actions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-8 py-8 text-on-surface-variant">
                  {t('settings.loadingUsers')}
                </td>
              </tr>
            ) : null}
            {users.map((user) => (
              <tr
                key={user.id}
                className={cn(
                  'hover:bg-white/[0.03] transition-all group',
                  user.status === 'Disabled' && 'opacity-50 grayscale',
                )}
              >
                <td className="px-6 xl:px-8 py-4">
                  <UserIdentity user={user} />
                </td>
                <td className="px-6 xl:px-8 py-4">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-6 xl:px-8 py-4">
                  <span
                    className={cn(
                      'text-xs font-bold',
                      user.status === 'Active' ? 'text-tertiary' : 'text-on-surface-variant opacity-60',
                    )}
                  >
                    {user.status === 'Active' ? t('common.active') : t('common.disabled')}
                  </span>
                </td>
                <td className="px-6 xl:px-8 py-4 font-mono text-xs text-on-surface-variant opacity-80">
                  <p className="font-bold text-on-surface">{user.subscriptionStatus}</p>
                  <p className="mt-0.5">{user.subscriptionPlan}</p>
                  <p className="mt-0.5 opacity-70">{user.subscriptionExpires}</p>
                </td>
                <td className="px-6 xl:px-8 py-4 font-mono text-xs text-on-surface-variant opacity-80">
                  {user.lastSession}
                </td>
                <td className="px-6 xl:px-8 py-4">
                  <SettingsUserRowMenu
                    user={user}
                    onEdit={() => onEdit(user)}
                    onToggleActive={() => void onToggleActive(user.id)}
                    onDelete={() => onDelete(user.id)}
                    onExtendSubscription={() => onExtendSubscription(user)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useUsersList({ page, limit: PAGE_LIMIT });
  const { create, update, toggleActive, remove } = useUserMutations();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER' as 'ADMIN' | 'USER',
  });
  const [error, setError] = useState('');
  const [editUser, setEditUser] = useState<{ id: string; name: string; role: 'ADMIN' | 'USER' } | null>(
    null,
  );
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [extendUser, setExtendUser] = useState<{
    id: string;
    subscriptionExpiresAt?: string | null;
  } | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [extendMode, setExtendMode] = useState<ExtendMode>('add_days');
  const [extendManualAt, setExtendManualAt] = useState('');

  const users = (data?.items ?? []).map(mapUserToTableRow);
  const total = data?.meta.total ?? 0;

  const handleInvite = async () => {
    setError('');
    try {
      await create.mutateAsync(inviteForm);
      setShowInvite(false);
      setInviteForm({ name: '', email: '', password: '', role: 'USER' });
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setError('');
    try {
      await update.mutateAsync({
        id: editUser.id,
        dto: { name: editUser.name, role: editUser.role },
      });
      setEditUser(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleToggleActive = async (id: string) => {
    setError('');
    try {
      await toggleActive.mutateAsync(id);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!deleteUserId) return;
    setError('');
    try {
      await remove.mutateAsync(deleteUserId);
      setDeleteUserId(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleSaveExtend = async () => {
    if (!extendUser) return;
    setError('');
    try {
      let expiresAt: Date;
      if (extendMode === 'pick_datetime') {
        expiresAt = new Date(extendManualAt);
      } else {
        const base = extendUser.subscriptionExpiresAt
          ? new Date(extendUser.subscriptionExpiresAt)
          : new Date();
        if (Number.isNaN(base.getTime())) {
          throw new Error(t('settings.invalidExpiry'));
        }
        const start = new Date(Math.max(base.getTime(), Date.now()));
        start.setDate(start.getDate() + extendDays);
        expiresAt = start;
      }
      if (Number.isNaN(expiresAt.getTime())) {
        throw new Error(t('settings.invalidExpiry'));
      }
      await billingApi.adminSetSubscription(extendUser.id, {
        subscriptionExpiresAt: expiresAt.toISOString(),
        subscriptionStatus: 'ACTIVE',
      });
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      setExtendUser(null);
    } catch (err) {
      setError(err instanceof Error && err.message === t('settings.invalidExpiry')
        ? err.message
        : apiErrorMessage(err));
    }
  };

  const stats = [
    {
      label: t('settings.adminRatio'),
      value: '12.5%',
      sub: t('settings.adminRatioTarget'),
      icon: Shield,
      trend: '-2%',
    },
    {
      label: t('settings.twoFa'),
      value: '100%',
      sub: t('settings.twoFaPolicy'),
      icon: ShieldCheck,
      trend: t('settings.secure'),
    },
    {
      label: t('settings.inviteExpiry'),
      value: '03',
      sub: t('settings.pendings24h'),
      icon: Key,
      trend: t('settings.newBadge', { n: 3 }),
    },
  ];

  return (
    <div className="pb-12 sm:pb-20 min-w-0 max-w-full space-y-6 sm:space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end">
        <div className="flex-1 min-w-0">
          <nav className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-on-surface-variant opacity-60">
            <span>{t('settings.title')}</span>
            <ChevronRight size={12} className="shrink-0" />
            <span className="text-primary opacity-100">{t('settings.breadcrumbUserManagement')}</span>
          </nav>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-on-surface">
            {t('settings.accessControl')}
          </h2>
          <p className="prose-description text-on-surface-variant text-sm sm:text-body-md mt-1 italic">
            {t('settings.subtitle')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="flex items-center justify-center gap-2.5 w-full sm:w-auto px-5 sm:px-8 py-3 sm:py-3.5 bg-primary-container text-on-primary-container rounded-2xl text-sm font-bold hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-primary-container/20 shrink-0"
        >
          <UserPlus size={20} className="shrink-0" />
          <span>{t('settings.inviteUser')}</span>
        </button>
      </header>

      {error && !showInvite && !editUser && !deleteUserId && !extendUser ? (
        <p className="text-error text-sm px-0.5 break-words">{error}</p>
      ) : null}

      <div className="glass-panel rounded-2xl sm:rounded-3xl shadow-2xl min-w-0">
        <div className="flex items-center justify-between px-4 sm:p-6 py-3 border-b border-white/5 bg-white/[0.02]">
          <div className="text-[10px] sm:text-[11px] font-mono text-on-surface-variant uppercase tracking-widest font-bold opacity-60">
            {t('settings.registeredUsers', { n: total })}
          </div>
        </div>

        <SettingsUserList
          users={users}
          isLoading={isLoading}
          onEdit={(user) =>
            setEditUser({ id: user.id, name: user.name, role: user.role as 'ADMIN' | 'USER' })
          }
          onToggleActive={handleToggleActive}
          onDelete={setDeleteUserId}
          onExtendSubscription={(user) => {
            const raw = data?.items.find((u) => u.id === user.id);
            setExtendUser({
              id: user.id,
              subscriptionExpiresAt: raw?.subscriptionExpiresAt,
            });
            setExtendDays(30);
            setExtendMode('add_days');
            setExtendManualAt(
              defaultManualExpiry(raw?.subscriptionExpiresAt, 30),
            );
          }}
        />

        <Pagination
          page={page}
          limit={PAGE_LIMIT}
          total={total}
          onPageChange={setPage}
          className="p-4 sm:p-6 border-t border-white/5 bg-white/[0.01]"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="glass-card p-4 sm:p-6 rounded-2xl sm:rounded-3xl relative overflow-hidden group min-w-0"
          >
            <stat.icon
              size={40}
              className="absolute right-3 top-3 sm:right-4 sm:top-4 text-on-surface-variant opacity-[0.03] sm:w-[50px] sm:h-[50px] group-hover:scale-110 group-hover:opacity-[0.08] transition-all duration-500"
            />
            <h4 className="text-[9px] sm:text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-[0.15em] sm:tracking-[0.2em] mb-3 sm:mb-4 pr-10">
              {stat.label}
            </h4>
            <div className="flex items-end gap-3 sm:gap-4 flex-wrap">
              <span className="text-2xl sm:text-3xl font-bold text-on-surface tracking-tighter leading-none">
                {stat.value}
              </span>
              <span
                className={cn(
                  'text-[10px] font-mono font-bold mb-0.5 sm:mb-1',
                  stat.trend === t('settings.secure') ? 'text-tertiary' : 'text-primary',
                )}
              >
                {stat.trend}
              </span>
            </div>
            <p className="text-[9px] sm:text-[10px] font-bold text-on-surface-variant opacity-40 uppercase tracking-widest mt-3 sm:mt-4 flex items-center gap-2">
              <History size={10} className="shrink-0" />
              <span className="min-w-0">{stat.sub}</span>
            </p>
          </div>
        ))}
      </div>

      {showInvite ? (
        <div className={MODAL_SHELL}>
          <div className={MODAL_PANEL}>
            <h3 className="text-lg sm:text-xl font-bold">{t('settings.inviteTitle')}</h3>
            {error ? <p className="text-error text-sm break-words">{error}</p> : null}
            <input
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm"
              placeholder={t('common.name')}
              value={inviteForm.name}
              onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
            />
            <input
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm"
              placeholder={t('common.email')}
              type="email"
              autoComplete="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            />
            <input
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm"
              placeholder={t('common.password')}
              type="password"
              autoComplete="new-password"
              value={inviteForm.password}
              onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
            />
            <select
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm"
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as 'ADMIN' | 'USER' })}
            >
              <option value="USER">{t('status.USER')}</option>
              <option value="ADMIN">{t('status.ADMIN')}</option>
            </select>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowInvite(false);
                  setError('');
                }}
                className="flex-1 py-3 rounded-xl border border-white/10 text-sm font-bold"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleInvite()}
                className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm"
              >
                {t('settings.createUser')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editUser ? (
        <div className={MODAL_SHELL}>
          <div className={MODAL_PANEL}>
            <h3 className="text-lg sm:text-xl font-bold">{t('settings.editTitle')}</h3>
            {error ? <p className="text-error text-sm break-words">{error}</p> : null}
            <input
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm"
              placeholder={t('common.name')}
              value={editUser.name}
              onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
            />
            <select
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm"
              value={editUser.role}
              onChange={(e) => setEditUser({ ...editUser, role: e.target.value as 'ADMIN' | 'USER' })}
            >
              <option value="USER">{t('status.USER')}</option>
              <option value="ADMIN">{t('status.ADMIN')}</option>
            </select>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditUser(null);
                  setError('');
                }}
                className="flex-1 py-3 rounded-xl border border-white/10 text-sm font-bold"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm"
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteUserId ? (
        <div className={MODAL_SHELL}>
          <div className={MODAL_PANEL}>
            <h3 className="text-lg sm:text-xl font-bold">{t('settings.deleteTitle')}</h3>
            <p className="text-on-surface-variant text-sm">{t('settings.cannotUndo')}</p>
            {error ? <p className="text-error text-sm break-words">{error}</p> : null}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteUserId(null);
                  setError('');
                }}
                className="flex-1 py-3 rounded-xl border border-white/10 text-sm font-bold"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="flex-1 py-3 rounded-xl bg-error text-on-error font-bold text-sm"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {extendUser ? (
        <div className={MODAL_SHELL}>
          <div className={MODAL_PANEL}>
            <h3 className="text-lg sm:text-xl font-bold">{t('settings.extendSubscription')}</h3>
            {error ? <p className="text-error text-sm break-words">{error}</p> : null}
            <div className="flex gap-2 p-1 rounded-xl bg-surface-container-low border border-white/10">
              <button
                type="button"
                onClick={() => setExtendMode('add_days')}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors',
                  extendMode === 'add_days'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                {t('settings.extendModeAddDays')}
              </button>
              <button
                type="button"
                onClick={() => setExtendMode('pick_datetime')}
                className={cn(
                  'flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors',
                  extendMode === 'pick_datetime'
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:text-on-surface',
                )}
              >
                {t('settings.extendModePickDate')}
              </button>
            </div>
            {extendMode === 'add_days' ? (
              <>
                <label className="block text-xs font-mono uppercase tracking-widest text-on-surface-variant">
                  {t('settings.extendDays')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm"
                  value={extendDays}
                  onChange={(e) =>
                    setExtendDays(Math.max(1, parseInt(e.target.value, 10) || 30))
                  }
                />
              </>
            ) : (
              <>
                <label className="block text-xs font-mono uppercase tracking-widest text-on-surface-variant">
                  {t('settings.extendPickDateTime')}
                </label>
                <input
                  type="datetime-local"
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm"
                  value={extendManualAt}
                  onChange={(e) => setExtendManualAt(e.target.value)}
                />
                <p className="text-xs text-on-surface-variant">
                  {t('settings.extendPickDateTimeHint')}
                </p>
              </>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setExtendUser(null);
                  setError('');
                }}
                className="flex-1 py-3 rounded-xl border border-white/10 text-sm font-bold"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveExtend()}
                className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm"
              >
                {t('settings.saveSubscription')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
