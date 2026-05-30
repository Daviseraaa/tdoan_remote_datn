import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Terminal, AlertCircle } from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import { apiErrorMessage } from '@/src/lib/api';
import { isAuthenticated } from '@/src/lib/auth';
import { t } from '@/src/i18n/t';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated()) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh h-dvh bg-surface flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[150px] rounded-full" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-tertiary/5 blur-[120px] rounded-full" />
      <div className="relative w-full max-w-md glass-card rounded-3xl p-10 border border-white/10 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-lg bg-primary-container flex items-center justify-center">
            <Terminal className="text-on-primary-container" size={24} />
          </div>
          <div>
            <h1 className="font-bold text-xl text-primary">{t('common.brand')}</h1>
            <p className="font-mono text-[10px] text-on-surface-variant opacity-60">{t('login.subtitle')}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-error-container/20 border border-error/30 text-error text-sm">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-on-surface-variant mb-2">
              {t('common.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-on-surface outline-none focus:border-primary/50"
              placeholder={t('login.emailPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-on-surface-variant mb-2">
              {t('common.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-on-surface outline-none focus:border-primary/50"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-primary text-on-primary rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {loading ? t('login.signingIn') : t('login.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
