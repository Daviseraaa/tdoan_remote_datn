/** Payload OPEN_APP — khớp `agent/core/src/tasks/handlers/open_app.rs` */

export type OpenAppLaunchMode = 'path' | 'app' | 'query';

export interface OpenAppFormState {
  mode: OpenAppLaunchMode;
  value: string;
  fullscreen: boolean;
}

export const DEFAULT_OPEN_APP_FORM: OpenAppFormState = {
  mode: 'path',
  value: '',
  fullscreen: true,
};

export function parseOpenAppForm(
  command: string,
  payload?: Record<string, unknown> | null,
): OpenAppFormState {
  const p = payload ?? {};
  let mode: OpenAppLaunchMode = 'path';
  let value = command.trim();

  if (p.path != null && String(p.path).trim()) {
    mode = 'path';
    value = String(p.path).trim();
  } else if (p.app != null && String(p.app).trim()) {
    mode = 'app';
    value = String(p.app).trim();
  } else if (p.query != null && String(p.query).trim()) {
    mode = 'query';
    value = String(p.query).trim();
  }

  const fullscreen =
    typeof p.fullscreen === 'boolean' ? p.fullscreen : DEFAULT_OPEN_APP_FORM.fullscreen;

  return { mode, value, fullscreen };
}

export function buildOpenAppPayload(form: OpenAppFormState): Record<string, unknown> {
  const v = form.value.trim();
  const base =
    form.mode === 'path'
      ? { path: v }
      : form.mode === 'app'
        ? { app: v }
        : { query: v };
  return { ...base, fullscreen: form.fullscreen };
}

export function buildOpenAppTask(form: OpenAppFormState): {
  command: string;
  payload: Record<string, unknown>;
} {
  return {
    command: form.value.trim(),
    payload: buildOpenAppPayload(form),
  };
}
