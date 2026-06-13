import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  getGoogleRedirectUri,
  loadGoogleGsiScript,
  prefersGoogleRedirect,
} from '@/src/lib/googleAuth';
import { t } from '@/src/i18n/t';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

type GoogleSignInButtonProps = {
  mode: 'signin' | 'signup';
  disabled?: boolean;
  onSuccess: (idToken: string) => void | Promise<void>;
  onError?: () => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback?: (response: { credential?: string }) => void;
            auto_select?: boolean;
            ux_mode?: 'popup' | 'redirect';
            login_uri?: string;
            itp_support?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>,
          ) => void;
        };
      };
    };
  }
}

export function isGoogleSignInEnabled(): boolean {
  return Boolean(GOOGLE_CLIENT_ID.trim());
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden width={18} height={18}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function GoogleSignInButton({
  mode,
  disabled,
  onSuccess,
  onError,
}: GoogleSignInButtonProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const googleHostRef = useRef<HTMLDivElement>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const [ready, setReady] = useState(false);
  const useRedirect = prefersGoogleRedirect();

  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!isGoogleSignInEnabled()) return;

    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const mountGoogleButton = () => {
      const shell = shellRef.current;
      const host = googleHostRef.current;
      if (cancelled || !shell || !host || !window.google?.accounts?.id) {
        return false;
      }

      const width = Math.min(400, Math.max(200, Math.floor(shell.offsetWidth)));
      if (width < 200) return false;

      host.innerHTML = '';

      const init: Parameters<typeof window.google.accounts.id.initialize>[0] = {
        client_id: GOOGLE_CLIENT_ID,
        auto_select: false,
        itp_support: true,
        ux_mode: useRedirect ? 'redirect' : 'popup',
      };

      if (useRedirect) {
        init.login_uri = getGoogleRedirectUri();
      } else {
        init.callback = (response) => {
          const token = response.credential;
          if (!token) {
            onErrorRef.current?.();
            return;
          }
          void onSuccessRef.current(token);
        };
      }

      window.google.accounts.id.initialize(init);

      window.google.accounts.id.renderButton(host, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width,
        text: 'continue_with',
      });

      setReady(true);
      return true;
    };

    const startObservers = () => {
      const shell = shellRef.current;
      if (shell && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (!cancelled) mountGoogleButton();
        });
        resizeObserver.observe(shell);
      }
    };

    void loadGoogleGsiScript()
      .then(() => {
        if (cancelled) return;
        if (!mountGoogleButton()) {
          pollTimer = setInterval(() => {
            if (mountGoogleButton() && pollTimer) {
              clearInterval(pollTimer);
              pollTimer = null;
            }
          }, 80);
        }
        startObservers();
      })
      .catch(() => {
        onErrorRef.current?.();
      });

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      resizeObserver?.disconnect();
    };
  }, [useRedirect]);

  if (!isGoogleSignInEnabled()) return null;

  const label =
    mode === 'signup' ? t('auth.signUpWithGoogle') : t('auth.signInWithGoogle');

  return (
    <div className="space-y-5">
      <div>
        <p className="block text-[10px] font-mono font-bold uppercase tracking-widest text-on-surface-variant mb-2">
          {t('auth.oauthLabel')}
        </p>
        <div
          ref={shellRef}
          className={cn(
            'relative w-full min-h-[52px] rounded-xl',
            disabled && 'pointer-events-none opacity-50',
          )}
        >
          <div
            className={cn(
              'pointer-events-none select-none',
              'rounded-xl border border-white/10 bg-surface-container-low',
              'flex items-center px-4 py-3',
            )}
            aria-hidden
          >
            <span
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                'bg-surface-container-high border border-white/10',
              )}
            >
              {disabled ? (
                <Loader2 size={16} className="animate-spin text-primary" />
              ) : (
                <GoogleLogo />
              )}
            </span>
            <span className="flex-1 text-center pr-8 text-sm font-bold text-on-surface">
              {label}
            </span>
          </div>

          <div
            ref={googleHostRef}
            className={cn(
              'absolute inset-0 z-10 overflow-hidden rounded-xl touch-manipulation',
              'opacity-[0.011] cursor-pointer',
              '[transform:translateZ(0)]',
              !ready && 'invisible',
            )}
            aria-label={label}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-on-surface-variant">
          {t('auth.orContinueWithEmail')}
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>
    </div>
  );
}
