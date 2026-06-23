import type { Edge } from '@xyflow/react';
import type { WorkflowStep, WorkflowStepConfig } from '@/src/types/api';
import { t } from '@/src/i18n/t';
import {
  WF_EDGE_TYPE,
  WF_HANDLE_BODY,
  WF_HANDLE_DEFAULT,
  WF_HANDLE_DONE,
  WF_HANDLE_FALSE,
  WF_HANDLE_TRUE,
  WF_TRIGGER_ID,
  type WfGraphEdge,
} from './types';
import {
  WF_NODE_LABEL_INSET,
  WF_NODE_LAYOUT_ROW_STEP_Y,
  WF_NODE_LAYOUT_STEP_X,
  type WfLayoutNodeMeta,
} from './nodeLayout';
import { layoutWithDagre } from './dagreLayout';

const H_STEP_X = WF_NODE_LAYOUT_STEP_X;
const H_BASE_Y = 240;
const TRIGGER_X = 48;
const ROW_GAP_Y = WF_NODE_LAYOUT_ROW_STEP_Y;

export type { WfLayoutNodeMeta };

function parseConfig(raw: unknown): WorkflowStepConfig {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as WorkflowStepConfig;
  }
  return {};
}

export function buildFlowEdge(
  id: string,
  source: string,
  target: string,
  sourceHandle?: string,
): Edge {
  const handle = sourceHandle ?? WF_HANDLE_DEFAULT;
  return {
    id,
    source,
    target,
    sourceHandle: handle === WF_HANDLE_DEFAULT ? undefined : sourceHandle,
    type: WF_EDGE_TYPE,
    animated: false,
    style: { stroke: 'rgba(164, 230, 255, 0.65)', strokeWidth: 2 },
    interactionWidth: 24,
    label: edgeLabel(handle),
    labelStyle: { fill: '#a4e6ff', fontSize: 10, fontWeight: 700 },
  };
}

function edgeLabel(handle?: string): string | undefined {
  if (handle === WF_HANDLE_TRUE) return t('workflows.branchTrue');
  if (handle === WF_HANDLE_FALSE) return t('workflows.branchFalse');
  if (handle === WF_HANDLE_BODY) return t('workflows.branchBody');
  if (handle === WF_HANDLE_DONE) return t('workflows.branchDone');
  return undefined;
}

const MIN_STEP_X_FROM_ORIGIN = TRIGGER_X + H_STEP_X - WF_NODE_LABEL_INSET;
const MIN_NODE_GAP_X = WF_NODE_LAYOUT_STEP_X - WF_NODE_LABEL_INSET;
const MIN_NODE_GAP_Y = WF_NODE_LAYOUT_ROW_STEP_Y - 16;

function readStepUi(step: WorkflowStep): { x: number; y: number } | null {
  const ui = parseConfig(step.config).ui;
  if (ui?.x == null || ui?.y == null) return null;
  if (!Number.isFinite(ui.x) || !Number.isFinite(ui.y)) return null;
  return { x: ui.x, y: ui.y };
}

export function isValidSavedLayout(steps: WorkflowStep[]): boolean {
  if (steps.length === 0) return false;

  const points = steps.map((s) => readStepUi(s));

  if (points.every((p) => p !== null)) {
    return true;
  }

  const validPoints = points.filter((p): p is { x: number; y: number } => p !== null);
  if (validPoints.length === 0) return false;

  for (const p of validPoints) {
    if (p.x < MIN_STEP_X_FROM_ORIGIN) return false;
  }

  for (let i = 0; i < validPoints.length; i++) {
    for (let j = i + 1; j < validPoints.length; j++) {
      const dx = Math.abs(validPoints[i].x - validPoints[j].x);
      const dy = Math.abs(validPoints[i].y - validPoints[j].y);
      if (dx < MIN_NODE_GAP_X && dy < MIN_NODE_GAP_Y) return false;
    }
  }

  if (validPoints.length >= 2) {
    const xs = validPoints.map((p) => p.x);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const minSpan = (validPoints.length - 1) * Math.max(MIN_NODE_GAP_X, H_STEP_X * 0.7);
    if (spanX < minSpan) return false;
  }

  return true;
}

export function computeGraphPositions(
  stepIds: string[],
  graphEdges: WfGraphEdge[],
  orderFallback: Map<string, number>,
  nodeMeta?: Map<string, WfLayoutNodeMeta>,
): Map<string, { x: number; y: number }> {
  return layoutWithDagre(stepIds, graphEdges, orderFallback, nodeMeta);
}

/** Sắp xếp lại vị trí node (dagre LR). */
export const normalizeGraphPositions = computeGraphPositions;

export function resolvePosition(
  id: string,
  config: WorkflowStepConfig,
  auto: Map<string, { x: number; y: number }>,
  useAuto: boolean,
  index: number,
): { x: number; y: number } {
  if (useAuto) {
    return auto.get(id) ?? { x: TRIGGER_X + H_STEP_X * (index + 1), y: H_BASE_Y };
  }
  const ui = parseConfig(config).ui;
  if (ui?.x != null && ui?.y != null && Number.isFinite(ui.x) && Number.isFinite(ui.y)) {
    return { x: ui.x, y: ui.y };
  }
  return auto.get(id) ?? { x: TRIGGER_X + H_STEP_X * (index + 1), y: H_BASE_Y };
}

const NODE_X_SPACING = H_STEP_X;

export {
  H_STEP_X,
  H_BASE_Y,
  TRIGGER_X,
  ROW_GAP_Y,
  NODE_X_SPACING,
};
