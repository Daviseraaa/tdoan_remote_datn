import { MessageCircle } from 'lucide-react';
import type { TemplateEditorState } from '@/src/lib/taskTemplatePayload';
import { TelegramSendConfigFields } from '@/src/components/workflow/TelegramSendConfigFields';
import { buildTelegramSendTask, parseTelegramSendForm } from '@/src/lib/telegramSendPayload';
import { t } from '@/src/i18n/t';
import { TemplateAdvancedFields } from './TemplateAdvancedFields';

type Props = {
  state: TemplateEditorState;
  onChange: (patch: Partial<TemplateEditorState>) => void;
};

export function TelegramSendTemplateForm({ state, onChange }: Props) {
  const form = parseTelegramSendForm(state.telegramSendPayload);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 border border-sky-400/20 bg-sky-400/5">
        <div className="flex items-center gap-3 mb-4">
          <MessageCircle className="text-sky-400" size={22} />
          <h3 className="font-bold text-on-surface">{t('taskType.TELEGRAM_SEND')}</h3>
        </div>
        <TelegramSendConfigFields
          payload={buildTelegramSendTask(form).payload}
          onChange={({ payload }) => onChange({ telegramSendPayload: payload })}
        />
      </div>
      <TemplateAdvancedFields
        timeout={state.timeout}
        priority={state.priority}
        onChange={(p) => onChange(p)}
      />
    </div>
  );
}
