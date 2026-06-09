/** Payload OPEN_BROWSER — khớp `agent/core/src/tasks/handlers/open_browser.rs` */

export type TriState = 'default' | 'on' | 'off';

export type OpenBrowserFormState = {
  url: string;
  useChromeProfile: boolean;
  chromeProfile: string;
  chromeUserDataDir: string;
  chromeExecutablePath: string;
  userDataDir: string;
  headless: TriState;
  humanize: TriState;
  keepOpen: TriState;
};

export const DEFAULT_OPEN_BROWSER_FORM: OpenBrowserFormState = {
  url: 'https://',
  useChromeProfile: false,
  chromeProfile: 'Default',
  chromeUserDataDir: '',
  chromeExecutablePath: '',
  userDataDir: '',
  headless: 'default',
  humanize: 'default',
  keepOpen: 'default',
};

function triFromPayload(v: unknown): TriState {
  if (v === true) return 'on';
  if (v === false) return 'off';
  return 'default';
}

function triToPayload(mode: TriState): boolean | undefined {
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  return undefined;
}

export function parseOpenBrowserForm(
  command: string,
  rawPayload?: Record<string, unknown> | null,
): OpenBrowserFormState {
  const p = rawPayload ?? {};
  const url =
    (typeof p.url === 'string' && p.url.trim()) ||
    command.trim() ||
    DEFAULT_OPEN_BROWSER_FORM.url;

  return {
    url,
    useChromeProfile: p.useChromeProfile === true,
    chromeProfile:
      typeof p.chromeProfile === 'string' && p.chromeProfile.trim()
        ? p.chromeProfile.trim()
        : 'Default',
    chromeUserDataDir: typeof p.chromeUserDataDir === 'string' ? p.chromeUserDataDir : '',
    chromeExecutablePath:
      typeof p.chromeExecutablePath === 'string' ? p.chromeExecutablePath : '',
    userDataDir: typeof p.userDataDir === 'string' ? p.userDataDir : '',
    headless: triFromPayload(p.headless),
    humanize: triFromPayload(p.humanize),
    keepOpen: triFromPayload(p.keepOpen),
  };
}

export function buildOpenBrowserTask(
  form: OpenBrowserFormState,
): { command: string; payload: Record<string, unknown> } {
  const url = form.url.trim();
  const payload: Record<string, unknown> = {};

  if (url) payload.url = url;

  const headless = triToPayload(form.headless);
  const humanize = triToPayload(form.humanize);
  const keepOpen = triToPayload(form.keepOpen);
  if (headless !== undefined) payload.headless = headless;
  if (humanize !== undefined) payload.humanize = humanize;
  if (keepOpen !== undefined) payload.keepOpen = keepOpen;

  if (form.useChromeProfile) {
    payload.useChromeProfile = true;
    payload.chromeProfile = form.chromeProfile.trim() || 'Default';
    const cud = form.chromeUserDataDir.trim();
    const cep = form.chromeExecutablePath.trim();
    if (cud) payload.chromeUserDataDir = cud;
    if (cep) payload.chromeExecutablePath = cep;
  } else {
    const udd = form.userDataDir.trim();
    if (udd) payload.userDataDir = udd;
  }

  return { command: url, payload };
}

export function openBrowserFormToPayloadRecord(
  form: OpenBrowserFormState,
): Record<string, unknown> {
  return buildOpenBrowserTask(form).payload;
}
