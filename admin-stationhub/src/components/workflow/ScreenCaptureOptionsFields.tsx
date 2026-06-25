import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import { DEFAULT_TELEGRAM_RECIPIENT } from '@/src/lib/telegramSendPayload';
import { WfTelegramBotSelect } from './WfTelegramBotSelect';

export type TelegramSendAs = 'photo' | 'document';

export type ScreenCapturePayload = {
  monitor?: number;
  includeBase64?: boolean;
  saveToFile?: boolean;
  onlySendTelegram?: boolean;
  savePath?: string;
  sendTelegram?: boolean;
  telegramSendAs?: TelegramSendAs;
  telegramFileName?: string;
  telegramBotId?: string;
  chatId?: string;
  caption?: string;
};

type Props = {
  payload: ScreenCapturePayload;
  command?: string;
  onChange: (next: ScreenCapturePayload, command?: string) => void;
  className?: string;
  compact?: boolean;
};

const inputCls =
  'w-full mt-1 px-4 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-sm';

export function ScreenCaptureOptionsFields({
  payload: p,
  command,
  onChange,
  className,
  compact,
}: Props) {
  const onlySend = p.onlySendTelegram === true || p.saveToFile === false;
  const sendTg = p.sendTelegram === true;

  const patch = (patch: Partial<ScreenCapturePayload>) => {
    onChange({ ...p, ...patch });
  };

  return (
    <div className={cn('space-y-3', className)}>
      {!compact ? (
        <p className="text-xs text-amber-400/90">{t('screenCapture.banner')}</p>
      ) : null}
      <div>
        <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
          {t('screenCapture.monitor')}
        </label>
        <input
          type="number"
          min={0}
          value={p.monitor ?? Number(command ?? 0)}
          onChange={(e) => {
            const m = Number(e.target.value);
            onChange({ ...p, monitor: m }, String(m));
          }}
          className={inputCls}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={sendTg}
          onChange={(e) =>
            patch({
              sendTelegram: e.target.checked,
              ...(e.target.checked
                ? {
                    chatId: (p.chatId?.trim() || DEFAULT_TELEGRAM_RECIPIENT),
                    telegramSendAs: p.telegramSendAs ?? 'photo',
                  }
                : {}),
            })
          }
        />
        {t('screenCapture.sendTelegram')}
      </label>

      {sendTg ? (
        <div className="space-y-3 rounded-xl border border-sky-400/20 bg-sky-400/5 p-3">
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('triggers.selectBot')}
            </label>
            <WfTelegramBotSelect
              value={p.telegramBotId ?? ''}
              onChange={(id) => patch({ telegramBotId: id || undefined })}
            />
          </div>
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('workflows.telegramChatId')}
            </label>
            <input
              value={p.chatId ?? DEFAULT_TELEGRAM_RECIPIENT}
              onChange={(e) => patch({ chatId: e.target.value })}
              className={cn(inputCls, 'font-mono')}
            />
          </div>
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('screenCapture.telegramSendAs')}
            </label>
            <select
              value={p.telegramSendAs ?? 'photo'}
              onChange={(e) =>
                patch({ telegramSendAs: e.target.value as TelegramSendAs })
              }
              className={inputCls}
            >
              <option value="photo">{t('screenCapture.telegramAsPhoto')}</option>
              <option value="document">{t('screenCapture.telegramAsDocument')}</option>
            </select>
          </div>
          {(p.telegramSendAs ?? 'photo') === 'document' ? (
            <div>
              <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
                {t('screenCapture.telegramFileName')}
              </label>
              <input
                value={p.telegramFileName ?? 'screenshot.png'}
                onChange={(e) => patch({ telegramFileName: e.target.value })}
                className={cn(inputCls, 'font-mono')}
              />
            </div>
          ) : null}
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('screenCapture.caption')}
            </label>
            <input
              value={p.caption ?? ''}
              onChange={(e) => patch({ caption: e.target.value || undefined })}
              className={inputCls}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={onlySend}
              onChange={(e) => {
                const v = e.target.checked;
                patch({
                  onlySendTelegram: v,
                  saveToFile: !v,
                  ...(v ? { savePath: undefined } : {}),
                });
              }}
            />
            {t('screenCapture.onlySendTelegram')}
          </label>
        </div>
      ) : null}

      {!onlySend ? (
        <>
          <div>
            <label className="text-[10px] font-mono font-bold uppercase text-on-surface-variant">
              {t('screenCapture.savePath')}
            </label>
            <input
              value={p.savePath ?? ''}
              onChange={(e) => {
                const v = e.target.value.trim();
                patch({ savePath: v || undefined, saveToFile: true });
              }}
              placeholder={t('screenCapture.savePathPlaceholder')}
              className={cn(inputCls, 'font-mono')}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={p.includeBase64 !== false}
              onChange={(e) => patch({ includeBase64: e.target.checked })}
            />
            {t('screenCapture.includeBase64')}
          </label>
        </>
      ) : compact ? null : (
        <p className="text-[10px] text-on-surface-variant">{t('screenCapture.onlySendHint')}</p>
      )}
    </div>
  );
}
