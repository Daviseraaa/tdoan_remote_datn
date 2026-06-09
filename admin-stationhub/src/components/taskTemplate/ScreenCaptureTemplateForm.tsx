import { Camera } from 'lucide-react';
import { t } from '@/src/i18n/t';
import type { TemplateEditorState } from '@/src/lib/taskTemplatePayload';
import {
  ScreenCaptureOptionsFields,
  type ScreenCapturePayload,
} from '@/src/components/workflow/ScreenCaptureOptionsFields';

type Props = {
  form: TemplateEditorState;
  patch: (p: Partial<TemplateEditorState>) => void;
};

function formToPayload(form: TemplateEditorState): ScreenCapturePayload {
  return {
    monitor: form.screenMonitor,
    includeBase64: form.screenIncludeBase64,
    savePath: form.screenSavePath || undefined,
    saveToFile: form.screenOnlySendTelegram ? false : form.screenSaveToFile,
    sendTelegram: form.screenSendTelegram,
    onlySendTelegram: form.screenOnlySendTelegram,
    telegramBotId: form.screenTelegramBotId || undefined,
    chatId: form.screenTelegramChatId || undefined,
    caption: form.screenTelegramCaption || undefined,
    telegramSendAs: form.screenTelegramSendAs,
    telegramFileName: form.screenTelegramFileName || undefined,
  };
}

export function ScreenCaptureTemplateForm({ form, patch }: Props) {
  return (
    <div className="glass-card rounded-2xl p-6 border border-white/10 space-y-5">
      <div className="flex items-center gap-3">
        <Camera size={22} className="text-primary" />
        <div>
          <h3 className="font-bold text-on-surface">{t('taskType.SCREEN_CAPTURE')}</h3>
          <p className="text-sm text-on-surface-variant">{t('taskType.SCREEN_CAPTURE_desc')}</p>
        </div>
      </div>
      <ScreenCaptureOptionsFields
        payload={formToPayload(form)}
        command={String(form.screenMonitor)}
        onChange={(next, cmd) => {
          patch({
            screenMonitor: next.monitor ?? form.screenMonitor,
            screenIncludeBase64: next.includeBase64 ?? form.screenIncludeBase64,
            screenSavePath: next.savePath ?? '',
            screenSaveToFile: next.saveToFile ?? true,
            screenSendTelegram: next.sendTelegram ?? false,
            screenOnlySendTelegram: next.onlySendTelegram ?? false,
            screenTelegramBotId: next.telegramBotId ?? '',
            screenTelegramChatId: next.chatId ?? '',
            screenTelegramCaption: next.caption ?? '',
            screenTelegramSendAs: next.telegramSendAs ?? 'photo',
            screenTelegramFileName: next.telegramFileName ?? 'screenshot.png',
            ...(cmd != null ? { screenMonitor: Number(cmd) } : {}),
          });
        }}
      />
    </div>
  );
}
