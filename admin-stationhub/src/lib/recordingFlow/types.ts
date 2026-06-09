export type RecordingFlowModule = 'chrome' | 'desktop';

export type RecordingFlowNodeData = {
  stepId: string;
  action: string;
  actionLabel: string;
  summary: string;
  label: string;
  index: number;
  module: RecordingFlowModule;
};
