import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { copyToClipboard } from '@/src/lib/copyToClipboard';
import { t } from '@/src/i18n/t';

const COPIED_MS = 2000;

type Props = {
  text: string;
  disabled?: boolean;
  onError?: () => void;
  className?: string;
  iconSize?: number;
  /** Chỉ icon, không chữ */
  iconOnly?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  title?: string;
};

export function CopyButton({
  text,
  disabled,
  onError,
  className,
  iconSize = 16,
  iconOnly = false,
  copyLabel,
  copiedLabel,
  title,
}: Props) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    if (disabled || copied) return;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPIED_MS);
    } else {
      onError?.();
    }
  };

  const label = copied
    ? (copiedLabel ?? t('common.copied'))
    : (copyLabel ?? t('common.copy'));

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void handleClick()}
      title={title ?? (copied ? t('common.copied') : t('common.copy'))}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-all duration-200',
        copied && 'text-tertiary bg-tertiary/20',
        disabled && 'opacity-40 pointer-events-none',
        className,
      )}
    >
      {copied ? <Check size={iconSize} className="shrink-0" /> : <Copy size={iconSize} className="shrink-0" />}
      {!iconOnly ? <span>{label}</span> : null}
    </button>
  );
}
