import React from 'react';
import type { TemplateEditorState } from '@/src/lib/taskTemplatePayload';
import { HttpRequestEditor } from '@/src/components/http/HttpRequestEditor';
import { TemplateAdvancedFields } from './TemplateAdvancedFields';

type Props = {
  state: TemplateEditorState;
  onChange: (patch: Partial<TemplateEditorState>) => void;
};

export function HttpRequestTemplateForm({ state, onChange }: Props) {
  return (
    <div className="space-y-6">
      <HttpRequestEditor
        value={{
          url: state.command,
          method: state.httpMethod,
          headersJson: state.httpHeadersJson,
          body: state.httpBody,
        }}
        onChange={(patch) =>
          onChange({
            ...(patch.url != null ? { command: patch.url } : {}),
            ...(patch.method != null ? { httpMethod: patch.method } : {}),
            ...(patch.headersJson != null ? { httpHeadersJson: patch.headersJson } : {}),
            ...(patch.body != null ? { httpBody: patch.body } : {}),
          })
        }
      />

      <TemplateAdvancedFields
        timeout={state.timeout}
        priority={state.priority}
        onChange={(p) => onChange(p)}
      />
    </div>
  );
}
