import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { BrandLogo } from '@/src/components/BrandLogo';
import { useAuth } from '@/src/hooks/useAuth';
import * as authApi from '@/src/api/auth';
import { apiErrorMessage } from '@/src/lib/api';
import { isAuthenticated } from '@/src/lib/auth';
import { GoogleSignInButton } from '@/src/components/auth/GoogleSignInButton';
import { t } from '@/src/i18n/t';

type RegisterStep = 'form' | 'verify';

export default function Register() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';

  const [step, setStep] = useState<RegisterStep>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  if (isAuthenticated()) {
    return <Navigate to={from} replace />;
  }

  const handleGoogleSuccess = async (idToken: string) => {
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await loginWithGoogle(idToken);
      navigate('/billing', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await authApi.sendRegisterOtp(email);
      setStep('verify');
      setOtp('');
      setResendCooldown(res.cooldownSeconds);
      setInfo(t('register.otpSent', { email }));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await authApi.sendRegisterOtp(email);
      setResendCooldown(res.cooldownSeconds);
      setInfo(t('register.otpSent', { email }));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(name, email, password, otp);
      navigate('/billing', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh h-dvh bg-surface flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[150px] rounded-full" />
      <div className="relative w-full max-w-md glass-card rounded-3xl p-10 border border-white/10 shadow-2xl">
        <div className="flex items-center gap-3 mb-8">
          <BrandLogo size={48} className="w-12 h-12" />
          <div>
            <h1 className="font-bold text-xl text-primary">{t('register.title')}</h1>
            <p className="font-mono text-[10px] text-on-surface-variant opacity-60">
              {t('register.subtitle')}
            </p>
          </div>
        </div>

        {error ? (
          <div className="flex items-center gap-2 p-3 mb-5 rounded-xl bg-error-container/20 border border-error/30 text-error text-sm">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        ) : null}

        {step === 'form' ? (
          <>
            <GoogleSignInButton
              mode="signup"
              disabled={loading}
              onSuccess={handleGoogleSuccess}
              onError={() => setError(t('register.googleError'))}
            />
            <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                {t('register.name')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-on-surface outline-none focus:border-primary/50"
              />
            </div>
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
                minLength={6}
                className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-on-surface outline-none focus:border-primary/50"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-primary text-on-primary rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {loading ? t('register.sendingOtp') : t('register.sendOtp')}
            </button>
          </form>
          </>
        ) : (
          <form onSubmit={handleRegister} className="space-y-5">
            {error ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-error-container/20 border border-error/30 text-error text-sm">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            ) : null}
            {info ? (
              <p className="text-sm text-primary bg-primary/10 border border-primary/20 rounded-xl p-3">
                {info}
              </p>
            ) : null}
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                {t('register.otp')}
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-on-surface outline-none focus:border-primary/50 tracking-[0.4em] text-center text-lg font-mono"
              />
              <p className="mt-2 text-xs text-on-surface-variant">{t('register.otpHint')}</p>
            </div>
            <button
              type="button"
              disabled={loading || resendCooldown > 0}
              onClick={() => void handleResendOtp()}
              className="w-full py-2.5 rounded-xl border border-white/10 text-sm font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-50"
            >
              {resendCooldown > 0
                ? t('register.resendOtpWait', { s: resendCooldown })
                : t('register.resendOtp')}
            </button>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-3.5 bg-primary text-on-primary rounded-xl font-bold hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {loading ? t('register.submitting') : t('register.submit')}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('form');
                setError('');
                setInfo('');
                setOtp('');
              }}
              className="w-full py-2 text-sm text-on-surface-variant hover:text-on-surface"
            >
              {t('register.backToForm')}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-on-surface-variant">
          {t('register.hasAccount')}{' '}
          <Link to="/login" className="text-primary font-bold hover:underline">
            {t('register.loginLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
