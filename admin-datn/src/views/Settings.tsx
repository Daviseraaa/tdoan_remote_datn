import React, { useEffect, useRef, useState } from 'react';
import {
  UserPlus,
  ChevronRight,
  MoreVertical,
  ShieldCheck,
  History,
  Shield,
  Key,
  Pencil,
  Trash2,
  UserX,
  UserCheck,
} from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { Pagination } from '@/src/components/Pagination';
import { useUsersList, useUserMutations } from '@/src/hooks/useUsers';
import { mapUserToTableRow } from '@/src/lib/mappers';
import { apiErrorMessage } from '@/src/lib/api';

const PAGE_LIMIT = 20;

export default function Settings() {
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
  const [menuUserId, setMenuUserId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<{ id: string; name: string; role: 'ADMIN' | 'USER' } | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const users = (data?.items ?? []).map(mapUserToTableRow);
  const total = data?.meta.total ?? 0;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuUserId(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

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
    setMenuUserId(null);
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

  return (
    <div className="pb-20 space-y-10">
      <div className="flex justify-between items-end">
        <div>
          <nav className="flex items-center gap-2 mb-2 text-xs font-bold uppercase tracking-widest text-on-surface-variant opacity-60">
            <span>Settings</span>
            <ChevronRight size={12} />
            <span className="text-primary opacity-100">User Management</span>
          </nav>
          <h2 className="text-4xl font-bold tracking-tight text-on-surface">System Access Control</h2>
          <p className="text-on-surface-variant text-body-md mt-1 italic">
            Manage platform participants, assign granular roles, and audit security sessions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2.5 px-8 py-3.5 bg-primary-container text-on-primary-container rounded-2xl font-bold hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-primary-container/20"
        >
          <UserPlus size={20} />
          <span>Invite New User</span>
        </button>
      </div>

      {error && !showInvite && !editUser && !deleteUserId && (
        <p className="text-error text-sm px-1">{error}</p>
      )}

      <div className="glass-panel rounded-3xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-white/[0.02]">
          <div className="text-[11px] font-mono text-on-surface-variant uppercase tracking-widest font-bold opacity-60">
            {total} registered users
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-white/[0.01] border-b border-white/5">
                <th className="px-8 py-5 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-on-surface-variant opacity-60">Identity</th>
                <th className="px-8 py-5 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-on-surface-variant opacity-60">Access Role</th>
                <th className="px-8 py-5 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-on-surface-variant opacity-60">Status</th>
                <th className="px-8 py-5 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-on-surface-variant opacity-60">Last Session</th>
                <th className="px-8 py-5 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="px-8 py-8 text-on-surface-variant">
                    Loading users…
                  </td>
                </tr>
              )}
              {users.map((user) => (
                <tr
                  key={user.id}
                  className={cn(
                    'hover:bg-white/[0.03] transition-all group',
                    user.status === 'Disabled' && 'opacity-50 grayscale',
                  )}
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="relative shrink-0">
                        <img
                          className="w-11 h-11 rounded-2xl bg-surface-container-highest border border-white/10 p-0.5 object-cover"
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatar}`}
                          alt={user.name}
                        />
                        {user.status === 'Active' && (
                          <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-tertiary rounded-full border-2 border-surface shadow-[0_0_8px_#68f5b8]" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-on-surface group-hover:text-primary transition-colors">
                          {user.name}
                        </div>
                        <div className="text-xs text-on-surface-variant font-mono lowercase opacity-70">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div
                      className={cn(
                        'inline-flex px-2 py-1 rounded-lg text-[9px] font-bold tracking-widest',
                        user.role === 'ADMIN'
                          ? 'bg-primary-container/10 text-primary border border-primary/20'
                          : 'bg-white/5 text-on-surface-variant border border-white/10',
                      )}
                    >
                      {user.role}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div
                      className={cn(
                        'flex items-center gap-2 text-xs font-bold',
                        user.status === 'Active' ? 'text-tertiary' : 'text-on-surface-variant opacity-60',
                      )}
                    >
                      {user.status}
                    </div>
                  </td>
                  <td className="px-8 py-5 font-mono text-xs text-on-surface-variant opacity-80">{user.lastSession}</td>
                  <td className="px-8 py-5 text-right relative" ref={menuUserId === user.id ? menuRef : undefined}>
                    <button
                      type="button"
                      onClick={() => setMenuUserId(menuUserId === user.id ? null : user.id)}
                      className="p-2 hover:bg-white/5 rounded-xl transition-all text-on-surface-variant hover:text-primary"
                    >
                      <MoreVertical size={20} />
                    </button>
                    {menuUserId === user.id && (
                      <div className="absolute right-8 top-full mt-1 z-20 min-w-[180px] glass-card rounded-xl border border-white/10 py-1 shadow-2xl">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuUserId(null);
                            setEditUser({ id: user.id, name: user.name, role: user.role as 'ADMIN' | 'USER' });
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2 hover:bg-white/5"
                        >
                          <Pencil size={14} /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleActive(user.id)}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2 hover:bg-white/5"
                        >
                          {user.status === 'Active' ? <UserX size={14} /> : <UserCheck size={14} />}
                          {user.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setMenuUserId(null);
                            setDeleteUserId(user.id);
                          }}
                          className="w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2 hover:bg-error/10 text-error"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          page={page}
          limit={PAGE_LIMIT}
          total={total}
          onPageChange={setPage}
          className="p-6 border-t border-white/5 bg-white/[0.01]"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Administrator Ratio', value: '12.5%', sub: 'Target: <15%', icon: Shield, trend: '-2%' },
          { label: '2FA Compliance', value: '100%', sub: 'Global Policy Active', icon: ShieldCheck, trend: 'SECURE' },
          { label: 'Invitation Expiry', value: '03', sub: 'Pendings < 24h', icon: Key, trend: '3 NEW' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-6 rounded-3xl relative overflow-hidden group">
            <stat.icon
              size={50}
              className="absolute right-4 top-4 text-on-surface-variant opacity-[0.03] group-hover:scale-110 group-hover:opacity-[0.08] transition-all duration-500"
            />
            <h4 className="text-[10px] font-mono font-bold text-on-surface-variant uppercase tracking-[0.2em] mb-4">
              {stat.label}
            </h4>
            <div className="flex items-end gap-4">
              <span className="text-3xl font-bold text-on-surface tracking-tighter leading-none">{stat.value}</span>
              <span
                className={cn(
                  'text-[10px] font-mono font-bold mb-1',
                  stat.trend === 'SECURE' ? 'text-tertiary' : 'text-primary',
                )}
              >
                {stat.trend}
              </span>
            </div>
            <p className="text-[10px] font-bold text-on-surface-variant opacity-40 uppercase tracking-widest mt-4 flex items-center gap-2">
              <History size={10} />
              {stat.sub}
            </p>
          </div>
        ))}
      </div>

      {showInvite && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-8 w-full max-w-md border border-white/10 space-y-4">
            <h3 className="text-xl font-bold">Invite New User</h3>
            {error && <p className="text-error text-sm">{error}</p>}
            <input
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10"
              placeholder="Name"
              value={inviteForm.name}
              onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
            />
            <input
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10"
              placeholder="Email"
              type="email"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
            />
            <input
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10"
              placeholder="Password"
              type="password"
              value={inviteForm.password}
              onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
            />
            <select
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10"
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as 'ADMIN' | 'USER' })}
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowInvite(false)} className="flex-1 py-3 rounded-xl border border-white/10">
                Cancel
              </button>
              <button type="button" onClick={() => void handleInvite()} className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-8 w-full max-w-md border border-white/10 space-y-4">
            <h3 className="text-xl font-bold">Edit User</h3>
            {error && <p className="text-error text-sm">{error}</p>}
            <input
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10"
              placeholder="Name"
              value={editUser.name}
              onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
            />
            <select
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10"
              value={editUser.role}
              onChange={(e) => setEditUser({ ...editUser, role: e.target.value as 'ADMIN' | 'USER' })}
            >
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditUser(null)} className="flex-1 py-3 rounded-xl border border-white/10">
                Cancel
              </button>
              <button type="button" onClick={() => void handleSaveEdit()} className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold">
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteUserId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-2xl p-8 w-full max-w-md border border-white/10 space-y-4">
            <h3 className="text-xl font-bold">Delete User</h3>
            <p className="text-on-surface-variant text-sm">This action cannot be undone.</p>
            {error && <p className="text-error text-sm">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setDeleteUserId(null)} className="flex-1 py-3 rounded-xl border border-white/10">
                Cancel
              </button>
              <button type="button" onClick={() => void handleDelete()} className="flex-1 py-3 rounded-xl bg-error text-on-error font-bold">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
