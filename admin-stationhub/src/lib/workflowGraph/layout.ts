import type { Edge } from '@xyflow/react';
import type { WorkflowStep, WorkflowStepConfig } from '@/src/types/api';
import { t } from '@/src/i18n/t';
import {
  WF_EDGE_TYPE,
  WF_HANDLE_DEFAULT,
  WF_HANDLE_FALSE,
  WF_HANDLE_TRUE,
  WF_TRIGGER_ID,
  type WfGraphEdge,
} from './types';

const H_STEP_X = 320;
const H_BASE_Y = 240;
const TRIGGER_X = 48;
const BRANCH_Y_OFFSET = 130;
const ROW_GAP_Y = 100;

type AdjOut = { targetId: string; handle: string };

function parseConfig(raw: unknown): WorkflowStepConfig {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as WorkflowStepConfig;
  }
  return {};
}

function buildAdjacency(graphEdges: WfGraphEdge[]): Map<string, AdjOut[]> {
  const adj = new Map<string, AdjOut[]>();
  for (const e of graphEdges) {
    const list = adj.get(e.source) ?? [];
    list.push({
      targetId: e.target,
      handle: e.sourceHandle ?? WF_HANDLE_DEFAULT,
    });
    adj.set(e.source, list);
  }
  return adj;
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
    label: edgeLabel(handle),
    labelStyle: { fill: '#a4e6ff', fontSize: 10, fontWeight: 700 },
  };
}

function edgeLabel(handle?: string): string | undefined {
  if (handle === WF_HANDLE_TRUE) return t('workflows.branchTrue');
  if (handle === WF_HANDLE_FALSE) return t('workflows.branchFalse');
  return undefined;
}

const MIN_STEP_X_FROM_ORIGIN = TRIGGER_X + H_STEP_X - 80;
const MIN_NODE_GAP_X = 240;
const MIN_NODE_GAP_Y = 90;

function readStepUi(step: WorkflowStep): { x: number; y: number } | null {
  const ui = parseConfig(step.config).ui;
  if (ui?.x == null || ui?.y == null) return null;
  if (!Number.isFinite(ui.x) || !Number.isFinite(ui.y)) return null;
  return { x: ui.x, y: ui.y };
}

export function isValidSavedLayout(steps: WorkflowStep[]): boolean {
  const points = steps
    .map((s) => readStepUi(s))
    .filter((p): p is { x: number; y: number } => p !== null);

  if (points.length === 0) return false;

  for (const p of points) {
    if (p.x < MIN_STEP_X_FROM_ORIGIN) return false;
  }

  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = Math.abs(points[i].x - points[j].x);
      const dy = Math.abs(points[i].y - points[j].y);
      if (dx < MIN_NODE_GAP_X && dy < MIN_NODE_GAP_Y) return false;
    }
  }

  if (points.length >= 2) {
    const xs = points.map((p) => p.x);
    const spanX = Math.max(...xs) - Math.min(...xs);
    if (spanX < Math.min(200, (points.length - 1) * 160)) return false;
  }

  return true;
}

export function computeGraphPositions(
  stepIds: string[],
  graphEdges: WfGraphEdge[],
  orderFallback: Map<string, number>,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  positions.set(WF_TRIGGER_ID, { x: TRIGGER_X, y: H_BASE_Y });

  const adj = buildAdjacency(graphEdges);
  const level = new Map<string, number>();
  level.set(WF_TRIGGER_ID, 0);
  const queue = [WF_TRIGGER_ID];

  while (queue.length) {
    const id = queue.shift()!;
    const depth = level.get(id)!;
    for (const { targetId } of adj.get(id) ?? []) {
      if (!stepIds.includes(targetId) && targetId !== WF_TRIGGER_ID) continue;
      const next = depth + 1;
      const prev = level.get(targetId);
      if (prev === undefined || next > prev) {
        level.set(targetId, next);
        queue.push(targetId);
      }
    }
  }

  for (const id of stepIds) {
    if (!level.has(id)) {
      level.set(id, orderFallback.get(id) ?? 1);
    }
  }

  const byLevel = new Map<number, string[]>();
  for (const id of stepIds) {
    const l = level.get(id) ?? 1;
    const list = byLevel.get(l) ?? [];
    list.push(id);
    byLevel.set(l, list);
  }

  for (const [lvl, ids] of byLevel) {
    const sorted = [...ids].sort(
      (a, b) => (orderFallback.get(a) ?? 0) - (orderFallback.get(b) ?? 0),
    );
    sorted.forEach((id, idx) => {
      const x = TRIGGER_X + lvl * H_STEP_X;
      const y = H_BASE_Y + (idx - (sorted.length - 1) / 2) * ROW_GAP_Y;
      positions.set(id, { x, y });
    });
  }

  for (const e of graphEdges) {
    if (e.source === WF_TRIGGER_ID) continue;
    const parent = positions.get(e.source);
    const child = positions.get(e.target);
    if (!parent || !child) continue;

    const childX = Math.max(parent.x + H_STEP_X, child.x);
    let childY = child.y;

    if (e.sourceHandle === WF_HANDLE_TRUE) {
      childY = parent.y - BRANCH_Y_OFFSET;
    } else if (e.sourceHandle === WF_HANDLE_FALSE) {
      childY = parent.y + BRANCH_Y_OFFSET;
    } else {
      childY = parent.y;
    }

    positions.set(e.target, { x: childX, y: childY });
  }

  return positions;
}

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

export {
  H_STEP_X,
  H_BASE_Y,
  TRIGGER_X,
  ROW_GAP_Y,
};
