import { MessageCircle } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import {
  type TelegramSendFormState,
  type TelegramSendMode,
  parseTelegramSendForm,
  buildTelegramSendTask,
} from '@/src/lib/telegramSendPayload';
import { t } from '@/src/i18n/t';
import { WfTelegramBotSelect } from './WfTelegramBotSelect';

const inputCls =
  'w-full mt-1 px-4 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-sm font-mono';
const labelCls = 'text-[10px] font-mono font-bold uppercase text-on-surface-variant';

const MODES: TelegramSendMode[] = ['message', 'photo', 'document'];

type Props = {
  payload?: Record<string, unknown> | null;
  onChange: (patch: { command: string; payload: Record<string, unknown> }) => void;
  compact?: boolean;
};

export function TelegramSendConfigFields({ payload, onChange, compact }: Props) {
  const form = parseTelegramSendForm(payload);

  const emit = (next: TelegramSendFormState) => {
    onChange(buildTelegramSendTask(next));
  };

  const patch = (p: Partial<TelegramSendFormState>) => emit({ ...form, ...p });

  return (
    <div
      className={cn(
        'space-y-4',
        compact ? '' : 'rounded-xl border border-sky-400/20 bg-sky-400/5 p-4',
      )}
    >
      {!compact ? (
        <div className="flex items-center gap-3">
          <MessageCircle size={20} className="text-sky-400 shrink-0" />
          <div>
            <h4 className="font-bold text-sm text-on-surface">{t('taskType.TELEGRAM_SEND')}</h4>
            <p className="text-xs text-on-surface-variant">{t('telegramSend.subtitle')}</p>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-sky-400/90">{t('telegramSend.agentBanner')}</p>

      <div>
        <label className={labelCls}>{t('triggers.selectBot')}</label>
        <WfTelegramBotSelect
          value={form.telegramBotId}
          onChange={(id) => patch({ telegramBotId: id })}
        />
      </div>

      <div>
        <label className={labelCls}>{t('workflows.telegramChatId')}</label>
        <input
          value={form.chatId}
          onChange={(e) => patch({ chatId: e.target.value })}
          className={inputCls}
        />
      </div>

      <div>
        <label className={labelCls}>{t('telegramSend.mode')}</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => patch({ mode: m })}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors',
                form.mode === m
                  ? 'bg-sky-400/15 border-sky-400/40 text-sky-300'
                  : 'border-white/10 text-on-surface-variant hover:bg-white/5',
              )}
            >
              {t(`telegramSend.mode_${m}` as 'telegramSend.mode_message')}
            </button>
          ))}
        </div>
      </div>

      {form.mode === 'message' ? (
        <div>
          <label className={labelCls}>{t('telegramSend.text')}</label>
          <textarea
            value={form.text}
            onChange={(e) => patch({ text: e.target.value })}
            rows={4}
            className={cn(inputCls, 'font-sans')}
          />
        </div>
      ) : (
        <>
          <div>
            <label className={labelCls}>{t('telegramSend.filePath')}</label>
            <input
              value={form.filePath}
              onChange={(e) => patch({ filePath: e.target.value })}
              placeholder="C:/Users/.../file.pdf"
              className={inputCls}
            />
            <p className="text-[10px] text-on-surface-variant mt-1">{t('telegramSend.filePathHint')}</p>
          </div>
          <div>
            <label className={labelCls}>{t('screenCapture.caption')}</label>
            <input
              value={form.caption}
              onChange={(e) => patch({ caption: e.target.value })}
              className={inputCls}
            />
          </div>
          {form.mode === 'document' ? (
            <div>
              <label className={labelCls}>{t('screenCapture.telegramFileName')}</label>
              <input
                value={form.fileName}
                onChange={(e) => patch({ fileName: e.target.value })}
                placeholder="report.pdf"
                className={inputCls}
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
