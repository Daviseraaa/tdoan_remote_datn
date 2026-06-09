import React from 'react';
import { t } from '@/src/i18n/t';

const FALLBACK_TITLE = 'Không tải được trang chỉnh sửa';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class EditorErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-dvh p-6 flex flex-col gap-4 justify-center bg-surface text-on-surface">
          <p className="text-error font-bold text-sm">{FALLBACK_TITLE}</p>
          <p className="text-xs font-mono text-on-surface-variant break-all">
            {this.state.error.message}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
            className="self-start px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-bold"
          >
            {t('common.retry')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
