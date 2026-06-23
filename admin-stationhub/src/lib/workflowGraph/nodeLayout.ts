/** Kích thước node vuông — dùng chung cho canvas và thuật toán layout. */

export const WF_NODE_ICON_SIZE = 52;
export const WF_NODE_LABEL_WIDTH = 124;
export const WF_NODE_LABEL_INSET = (WF_NODE_LABEL_WIDTH - WF_NODE_ICON_SIZE) / 2;
export const WF_NODE_BODY_HEIGHT = WF_NODE_ICON_SIZE + 8 + 34;

/** Khe giữa mép phải nhãn node này và mép trái nhãn node kế. */
export const WF_NODE_LAYOUT_GAP_X = 4;

/** Khe ngang thêm giữa hai cột dagre (node liên tiếp cùng hàng). */
export const WF_NODE_DAGRE_RANKSEP = 0;

/** Chiều rộng dùng cho dagre — khớp nhãn canvas (truncate), không nới theo tên đầy đủ. */
export const WF_NODE_DAGRE_LAYOUT_WIDTH = WF_NODE_LABEL_WIDTH;

/**
 * Bước ngang tối thiểu giữa hai node cùng hàng (góc trên-trái icon).
 * Nhãn tràn ±LABEL_INSET nên step ≥ LABEL_WIDTH + gap.
 */
export const WF_NODE_LAYOUT_STEP_X = WF_NODE_LABEL_WIDTH + WF_NODE_LAYOUT_GAP_X;

/** Khe dọc giữa hai node cùng cột / giữa các nhánh fan. */
export const WF_NODE_LAYOUT_GAP_Y = 28;
export const WF_NODE_LAYOUT_ROW_STEP_Y = WF_NODE_BODY_HEIGHT + WF_NODE_LAYOUT_GAP_Y;

/** Lệch dọc nhánh true/body (↑) và false/done (↓) so với node cha. */
export const WF_NODE_BRANCH_OFFSET_Y = WF_NODE_LAYOUT_ROW_STEP_Y + 56;

const CHAR_W_TITLE = 6.5;
const CHAR_W_SUBTITLE = 5.5;
const MAX_LABEL_ESTIMATE_W = 168;
/** Khớp truncate nhãn trên canvas (~32 ký tự) — tránh đẩy cột quá xa vì tên đầy đủ. */
const ESTIMATE_TITLE_MAX_CHARS = 36;

/** Ước lượng bước ngang cần cho node theo độ dài nhãn (tên/mô tả). */
export function estimateNodeLayoutStepX(label?: string, subtitle?: string): number {
  const titleLen = Math.min(label?.trim().length ?? 0, ESTIMATE_TITLE_MAX_CHARS);
  const subLen = Math.min(subtitle?.trim().length ?? 0, 24);
  const titleW = titleLen * CHAR_W_TITLE + WF_NODE_LABEL_INSET * 2;
  const subW = subLen * CHAR_W_SUBTITLE + WF_NODE_LABEL_INSET * 2;
  const est = Math.min(
    MAX_LABEL_ESTIMATE_W,
    Math.max(WF_NODE_LABEL_WIDTH, titleW, subW),
  );
  return Math.ceil(est) + WF_NODE_LAYOUT_GAP_X;
}

export type WfLayoutNodeMeta = {
  label?: string;
  subtitle?: string;
};
