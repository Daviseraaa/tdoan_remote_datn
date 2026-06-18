import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/src/hooks/useAuth';
import * as usersApi from '@/src/api/users';
import { setTokens } from '@/src/lib/auth';
import { isAdmin as checkAdmin } from '@/src/lib/apiScope';
import { t } from '@/src/i18n/t';

export default function GoogleAuthCallback() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      setError(t('login.googleError'));
      const timer = window.setTimeout(() => navigate('/login', { replace: true }), 2500);
      return () => window.clearTimeout(timer);
    }

    (async () => {
      try {
        setTokens(accessToken, refreshToken);
        const user = await usersApi.getMe();
        await refreshUser();
        const dest = checkAdmin(user) ? '/admin' : '/dashboard';
        navigate(dest, { replace: true });
      } catch {
        setError(t('login.googleError'));
        const timer = window.setTimeout(() => navigate('/login', { replace: true }), 2500);
        return () => window.clearTimeout(timer);
      }
    })();
  }, [navigate, refreshUser]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3 bg-surface text-on-surface-variant">
      {error ? (
        <p className="text-sm text-error px-6 text-center">{error}</p>
      ) : (
        <>
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm">{t('login.signingIn')}</p>
        </>
      )}
    </div>
  );
}
