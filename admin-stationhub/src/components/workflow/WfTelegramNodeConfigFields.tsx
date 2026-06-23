import type { TelegramStepAction, WorkflowStepConfig } from '@/src/types/api';
import { cn } from '@/src/lib/utils';
import { t } from '@/src/i18n/t';
import { WfTelegramBotSelect } from './WfTelegramBotSelect';

const TELEGRAM_ACTIONS: TelegramStepAction[] = [
  'send_message',
  'send_photo',
  'send_document',
  'reply_message',
  'edit_message',
  'inline_keyboard',
];

const inputCls =
  'w-full mt-1 px-4 py-2.5 rounded-xl bg-surface-container-low border border-white/10 text-sm font-mono';
const labelCls = 'text-[10px] font-mono font-bold uppercase text-on-surface-variant';

type Props = {
  config: WorkflowStepConfig;
  onPatch: (patch: Partial<WorkflowStepConfig>) => void;
};

export function WfTelegramNodeConfigFields({ config, onPatch }: Props) {
  const action = (config.action as TelegramStepAction) ?? 'send_message';

  const needsText =
    action === 'send_message' ||
    action === 'reply_message' ||
    action === 'edit_message' ||
    action === 'inline_keyboard' ||
    action === 'send_photo' ||
    action === 'send_document';

  const inlineKeyboardJson = (() => {
    const kb = config.inlineKeyboard;
    if (!kb) return '[]';
    try {
      return JSON.stringify(kb, null, 2);
    } catch {
      return '[]';
    }
  })();

  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>{t('workflows.telegramAction')}</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {TELEGRAM_ACTIONS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onPatch({ action: a })}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors',
                action === a
                  ? 'bg-sky-400/15 border-sky-400/40 text-sky-300'
                  : 'border-white/10 text-on-surface-variant hover:bg-white/5',
              )}
            >
              {t(`workflows.telegramAction_${a}` as 'workflows.telegramAction_send_message')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>{t('triggers.selectBot')}</label>
        <WfTelegramBotSelect
          value={config.telegramBotId ?? ''}
          onChange={(id) => onPatch({ telegramBotId: id || undefined })}
        />
      </div>

      <div>
        <label className={labelCls}>{t('workflows.telegramChatId')}</label>
        <input
          value={config.chatId ?? '{{telegram.chatId}}'}
          onChange={(e) => onPatch({ chatId: e.target.value })}
          className={inputCls}
        />
      </div>

      {action === 'send_photo' ? (
        <div>
          <label className={labelCls}>{t('workflows.telegramPhotoUrl')}</label>
          <input
            value={config.photoUrl ?? ''}
            onChange={(e) => onPatch({ photoUrl: e.target.value })}
            placeholder="https://… hoặc {{steps.prev.json.url}}"
            className={inputCls}
          />
        </div>
      ) : null}

      {action === 'send_document' ? (
        <div>
          <label className={labelCls}>{t('workflows.telegramDocumentUrl')}</label>
          <input
            value={config.documentUrl ?? ''}
            onChange={(e) => onPatch({ documentUrl: e.target.value })}
            placeholder="https://… hoặc đường dẫn file"
            className={inputCls}
          />
        </div>
      ) : null}

      {action === 'reply_message' ? (
        <div>
          <label className={labelCls}>{t('workflows.telegramReplyToMessageId')}</label>
          <input
            value={config.replyToMessageId ?? '{{telegram.messageId}}'}
            onChange={(e) => onPatch({ replyToMessageId: e.target.value })}
            className={inputCls}
          />
        </div>
      ) : null}

      {action === 'edit_message' ? (
        <div>
          <label className={labelCls}>{t('workflows.telegramMessageId')}</label>
          <input
            value={config.messageId ?? ''}
            onChange={(e) => onPatch({ messageId: e.target.value })}
            placeholder="{{steps.prev.json.messageId}}"
            className={inputCls}
          />
        </div>
      ) : null}

      {needsText ? (
        <div>
          <label className={labelCls}>
            {action === 'send_photo' || action === 'send_document'
              ? t('screenCapture.caption')
              : t('workflows.telegramText')}
          </label>
          <textarea
            value={config.text ?? ''}
            onChange={(e) => onPatch({ text: e.target.value })}
            rows={4}
            className={cn(inputCls, 'font-sans')}
          />
        </div>
      ) : null}

      {action === 'inline_keyboard' || action === 'edit_message' ? (
        <div>
          <label className={labelCls}>{t('workflows.telegramInlineKeyboard')}</label>
          <textarea
            value={inlineKeyboardJson}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (!raw) {
                onPatch({ inlineKeyboard: undefined });
                return;
              }
              try {
                const parsed = JSON.parse(raw) as WorkflowStepConfig['inlineKeyboard'];
                onPatch({ inlineKeyboard: parsed });
              } catch {
                /* ignore while typing */
              }
            }}
            rows={5}
            placeholder={'[\n  [{ "text": "OK", "callback_data": "ok" }]]\n'}
            className={inputCls}
          />
          <p className="text-[10px] text-on-surface-variant/70 mt-1">
            {t('workflows.telegramInlineKeyboardHint')}
          </p>
        </div>
      ) : null}

      {action === 'send_message' || action === 'reply_message' ? (
        <div>
          <label className={labelCls}>{t('workflows.telegramParseMode')}</label>
          <select
            value={config.parseMode ?? ''}
            onChange={(e) =>
              onPatch({
                parseMode: (e.target.value || undefined) as WorkflowStepConfig['parseMode'],
              })
            }
            className={inputCls}
          >
            <option value="">{t('workflows.telegramParseModeDefault')}</option>
            <option value="HTML">HTML</option>
            <option value="Markdown">Markdown</option>
            <option value="MarkdownV2">MarkdownV2</option>
          </select>
        </div>
      ) : null}
    </div>
  );
}
