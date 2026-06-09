/** Payload CLOSE_APP — khớp `agent/core/src/tasks/handlers/close_app.rs` */

export type CloseAppMode = 'pid' | 'processName' | 'windowTitle' | 'openedInRun';

export interface CloseAppFormState {
  mode: CloseAppMode;
  pid: string;
  processName: string;
  windowTitle: string;
}

export const DEFAULT_CLOSE_APP_FORM: CloseAppFormState = {
  mode: 'openedInRun',
  pid: '{{prev.json.pid}}',
  processName: 'notepad',
  windowTitle: '',
};

export function parseCloseAppForm(
  payload?: Record<string, unknown> | null,
): CloseAppFormState {
  const p = payload ?? {};
  const modeRaw = String(p.mode ?? 'openedInRun').toLowerCase();
  let mode: CloseAppMode = 'openedInRun';
  if (modeRaw === 'pid' || modeRaw === 'pids') mode = 'pid';
  else if (modeRaw === 'processname' || modeRaw === 'process_name') mode = 'processName';
  else if (modeRaw === 'windowtitle' || modeRaw === 'window_title') mode = 'windowTitle';
  else if (modeRaw === 'openedinrun' || modeRaw === 'opened_in_run') mode = 'openedInRun';

  return {
    mode,
    pid: p.pid != null ? String(p.pid) : DEFAULT_CLOSE_APP_FORM.pid,
    processName:
      p.processName != null
        ? String(p.processName)
        : p.process_name != null
          ? String(p.process_name)
          : DEFAULT_CLOSE_APP_FORM.processName,
    windowTitle:
      p.windowTitle != null
        ? String(p.windowTitle)
        : p.window_title != null
          ? String(p.window_title)
          : DEFAULT_CLOSE_APP_FORM.windowTitle,
  };
}

export function buildCloseAppPayload(form: CloseAppFormState): Record<string, unknown> {
  switch (form.mode) {
    case 'pid':
      return { mode: 'pid', pid: form.pid.trim() };
    case 'processName':
      return { mode: 'processName', processName: form.processName.trim() };
    case 'windowTitle':
      return { mode: 'windowTitle', windowTitle: form.windowTitle.trim() };
    case 'openedInRun':
    default:
      return { mode: 'openedInRun' };
  }
}

export function buildCloseAppTask(form: CloseAppFormState): {
  command: string;
  payload: Record<string, unknown>;
} {
  return {
    command: 'close',
    payload: buildCloseAppPayload(form),
  };
}
