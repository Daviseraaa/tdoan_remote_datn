import React from 'react';
import type { WorkflowStepConfig } from '@/src/types/api';
import { HttpRequestEditor } from '@/src/components/http/HttpRequestEditor';
import {
  buildHttpRequestPayload,
  parseHttpRequestPayload,
  type HttpMethod,
} from '@/src/lib/httpRequest';

type Props = {
  config: WorkflowStepConfig;
  onPatch: (patch: Partial<WorkflowStepConfig>) => void;
};

export function HttpRequestConfigFields({ config, onPatch }: Props) {
  const payload = (config.payload ?? {}) as Record<string, unknown>;
  const { method, headersJson, body } = parseHttpRequestPayload(payload);

  const sync = (patch: {
    url?: string;
    method?: HttpMethod;
    headersJson?: string;
    body?: string;
  }) => {
    const m = patch.method ?? method;
    const h = patch.headersJson ?? headersJson;
    const b = patch.body ?? body;
    onPatch({
      command: patch.url ?? config.command,
      payload: buildHttpRequestPayload(m, h, b),
    });
  };

  return (
    <HttpRequestEditor
      showIntro={false}
      value={{
        url: config.command ?? '',
        method,
        headersJson,
        body,
      }}
      onChange={sync}
    />
  );
}
