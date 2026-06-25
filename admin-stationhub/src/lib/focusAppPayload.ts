export type FocusAppMode = 'pid' | 'processName' | 'windowTitle';

export interface FocusAppFormState {
  mode: FocusAppMode;
  pid: string;
  processName: string;
  windowTitle: string;
}

export const DEFAULT_FOCUS_APP_FORM: FocusAppFormState = {
  mode: 'windowTitle',
  pid: '{{prev.json.pid}}',
  processName: 'notepad',
  windowTitle: '',
};

export function parseFocusAppForm(
  payload?: Record<string, unknown> | null,
): FocusAppFormState {
  const p = payload ?? {};
  const modeRaw = String(p.mode ?? 'windowTitle').toLowerCase();
  let mode: FocusAppMode = 'windowTitle';
  if (modeRaw === 'pid' || modeRaw === 'pids') mode = 'pid';
  else if (modeRaw === 'processname' || modeRaw === 'process_name') mode = 'processName';
  else if (modeRaw === 'windowtitle' || modeRaw === 'window_title') mode = 'windowTitle';

  return {
    mode,
    pid: p.pid != null ? String(p.pid) : DEFAULT_FOCUS_APP_FORM.pid,
    processName:
      p.processName != null
        ? String(p.processName)
        : p.process_name != null
          ? String(p.process_name)
          : DEFAULT_FOCUS_APP_FORM.processName,
    windowTitle:
      p.windowTitle != null
        ? String(p.windowTitle)
        : p.window_title != null
          ? String(p.window_title)
          : DEFAULT_FOCUS_APP_FORM.windowTitle,
  };
}

export function buildFocusAppPayload(form: FocusAppFormState): Record<string, unknown> {
  switch (form.mode) {
    case 'pid':
      return { mode: 'pid', pid: form.pid.trim() };
    case 'processName':
      return { mode: 'processName', processName: form.processName.trim() };
    case 'windowTitle':
    default:
      return { mode: 'windowTitle', windowTitle: form.windowTitle.trim() };
  }
}

export function buildFocusAppTask(form: FocusAppFormState): {
  command: string;
  payload: Record<string, unknown>;
} {
  return {
    command: 'focus',
    payload: buildFocusAppPayload(form),
  };
}
