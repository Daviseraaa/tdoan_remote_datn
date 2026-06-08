import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import * as triggersApi from '@/src/api/triggers';
import { ConfirmDialog } from './ConfirmDialog';
import { apiErrorMessage } from '@/src/lib/api';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';

const inputCls =
  'w-full mt-1 px-4 py-3 rounded-xl bg-surface-container-low border border-white/10 text-sm';

function shortenUrl(url: string, max = 36) {
  if (url.length <= max) return url;
  return `${url.slice(0, max)}…`;
}

type Props = {
  /** Ẩn tiêu đề khi nhúng trong trang /bots */
  hideTitle?: boolean;
};

export function TelegramBotsPanel({ hideTitle = false }: Props) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [botToken, setBotToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createdWebhookUrl, setCreatedWebhookUrl] = useState<string | null>(null);

  const { data: bots, isLoading } = useQuery({
    queryKey: ['telegram-bots'],
    queryFn: () => triggersApi.listTelegramBots(),
    refetchInterval: 30_000,
  });

  const createMut = useMutation({
    mutationFn: () =>
      triggersApi.createTelegramBot({
        name: name.trim(),
        botToken: botToken.trim(),
      }),
    onSuccess: async (bot) => {
      await qc.invalidateQueries({ queryKey: ['telegram-bots'] });
      setCreatedWebhookUrl(bot.webhookUrl ?? null);
      setName('');
      setBotToken('');
      setError(null);
    },
    onError: (err: unknown) => setError(apiErrorMessage(err)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => triggersApi.deleteTelegramBot(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['telegram-bots'] });
      await qc.invalidateQueries({ queryKey: ['workflow-triggers'] });
      setDeleteId(null);
    },
  });

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center px-0 sm:px-2 mb-4">
        {!hideTitle ? (
          <div>
            <h3 className="text-lg font-bold">{t('triggers.botsSectionTitle')}</h3>
            <p className="text-xs text-on-surface-variant mt-1">{t('triggers.botsSectionDesc')}</p>
          </div>
        ) : (
          <div className="min-w-0" />
        )}
        <button
          type="button"
          onClick={() => {
            setAddOpen(true);
            setError(null);
            setCreatedWebhookUrl(null);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-sky-400/30 text-sky-400 text-sm font-bold hover:bg-sky-400/10 shrink-0 w-full sm:w-auto"
        >
          <Plus size={16} />
          {t('triggers.addBot')}
        </button>
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        <div className="hidden sm:grid sm:grid-cols-[1fr_1.2fr_0.6fr_0.4fr] gap-2 px-5 py-3 text-[10px] font-mono font-bold uppercase text-on-surface-variant/70 border-b border-white/5">
          <span>{t('triggers.botName')}</span>
          <span>{t('triggers.webhookUrl')}</span>
          <span>{t('triggers.colStatus')}</span>
          <span className="text-right">{t('triggers.colActions')}</span>
        </div>
        {isLoading ? (
          <p className="p-5 text-sm text-on-surface-variant">{t('automations.loading')}</p>
        ) : null}
        {!isLoading && (bots?.length ?? 0) === 0 ? (
          <p className="p-5 text-sm text-on-surface-variant">{t('triggers.botsEmpty')}</p>
        ) : null}
        {(bots ?? []).map((b) => (
          <div
            key={b.id}
            className="px-4 py-4 sm:px-5 sm:py-3 text-sm border-b border-white/5 last:border-0 hover:bg-white/[0.03] space-y-2 sm:space-y-0 sm:grid sm:grid-cols-[1fr_1.2fr_0.6fr_0.4fr] sm:gap-2 sm:items-center"
          >
            <div className="min-w-0 flex items-start justify-between gap-2 sm:block">
              <div className="min-w-0">
                <span className="font-medium block truncate">{b.name}</span>
                {b.botUsername ? (
                  <span className="text-[10px] text-on-surface-variant">@{b.botUsername}</span>
                ) : null}
              </div>
              <div className="flex gap-1 sm:hidden shrink-0">
                <button
                  type="button"
                  title={t('triggers.delete')}
                  onClick={() => setDeleteId(b.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-error/20 text-error"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <span
              className="text-[10px] font-mono text-on-surface-variant truncate block"
              title={b.webhookUrl ?? t('triggers.webhookOnCreate')}
            >
              <span className="sm:hidden text-on-surface-variant/60 uppercase font-bold mr-1">
                {t('triggers.webhookUrl')}:
              </span>
              {b.webhookUrl ? shortenUrl(b.webhookUrl) : t('triggers.webhookOnCreate')}
            </span>
            <span className={b.enabled ? 'text-tertiary text-xs' : 'text-on-surface-variant text-xs'}>
              <span className="sm:hidden text-on-surface-variant/60 uppercase font-bold mr-1">
                {t('triggers.colStatus')}:
              </span>
              {b.enabled ? t('triggers.enabled') : t('triggers.disabled')}
            </span>
            <div className="hidden sm:flex gap-1 justify-end">
              <button
                type="button"
                title={t('triggers.delete')}
                onClick={() => setDeleteId(b.id)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-error/20 text-error"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {addOpen ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAddOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative w-full max-w-md glass-card rounded-3xl p-8 border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-2">{t('triggers.addBot')}</h3>
              <p className="text-xs text-on-surface-variant mb-6">{t('triggers.botsSectionDesc')}</p>
              {createdWebhookUrl ? (
                <div className="mb-6 rounded-xl border border-tertiary/30 bg-tertiary/10 p-4">
                  <p className="text-[10px] font-mono font-bold uppercase text-tertiary mb-2">
                    {t('triggers.webhookRegistered')}
                  </p>
                  <p className="text-[11px] font-mono break-all text-on-surface">{createdWebhookUrl}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setAddOpen(false);
                      setCreatedWebhookUrl(null);
                    }}
                    className="mt-4 w-full py-2 rounded-xl bg-primary text-on-primary font-bold text-sm"
                  >
                    {t('common.confirm')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                      {t('triggers.botName')}
                    </label>
                    <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
                    <label className="block text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                      {t('triggers.botToken')}
                    </label>
                    <input
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      type="password"
                      autoComplete="off"
                      className={cn(inputCls, 'font-mono')}
                    />
                    {error ? <p className="text-sm text-error">{error}</p> : null}
                  </div>
                  <div className="flex gap-3 mt-8">
                    <button
                      type="button"
                      onClick={() => setAddOpen(false)}
                      className="flex-1 py-3 rounded-xl border border-white/10 font-bold text-sm"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="button"
                      disabled={createMut.isPending}
                      onClick={() => createMut.mutate()}
                      className="flex-1 py-3 rounded-xl bg-primary text-on-primary font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {createMut.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                      {t('triggers.botsAddSubmit')}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <ConfirmDialog
        open={!!deleteId}
        message={t('triggers.deleteBotConfirm')}
        confirmLabel={t('triggers.delete')}
        danger
        pending={deleteMut.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMut.mutate(deleteId)}
      />
    </div>
  );
}
