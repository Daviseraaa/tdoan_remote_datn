import { AnimatePresence, motion } from 'motion/react';
import { t } from '@/src/i18n/t';

type Props = {
  open: boolean;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  open,
  message,
  confirmLabel,
  danger,
  pending,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative max-w-md w-full glass-card rounded-3xl p-8 border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-on-surface font-bold mb-6">{message}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 py-3 rounded-xl border border-white/10 font-bold text-sm"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={onConfirm}
                className={
                  danger
                    ? 'flex-1 py-3 rounded-xl bg-error text-on-error font-bold text-sm disabled:opacity-50'
                    : 'flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm disabled:opacity-50'
                }
              >
                {confirmLabel ?? t('common.confirm')}
              </button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
