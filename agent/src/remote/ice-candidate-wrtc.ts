/**
 * @roamhq/wrtc addIceCandidate rejects null sdpMLineIndex / loose JSON from browser+socket.io.
 * Chỉ giữ các field libwebrtc chấp nhận.
 */
export type WrtcIceCandidateInit = {
  candidate: string;
  sdpMid?: string;
  sdpMLineIndex?: number;
};

export function normalizeIceInitForWrtc(raw: unknown): WrtcIceCandidateInit | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const c = o.candidate;
  if (typeof c !== 'string' || !c.trim()) return null;

  const out: WrtcIceCandidateInit = { candidate: c.trim() };

  const mid = o.sdpMid;
  if (mid != null && mid !== '' && typeof mid === 'string') {
    out.sdpMid = mid;
  }

  let idx: unknown = o.sdpMLineIndex;
  if (typeof idx === 'string' && /^\d+$/.test(idx)) {
    idx = parseInt(idx, 10);
  }
  if (typeof idx === 'number' && Number.isInteger(idx) && idx >= 0 && idx <= 2147483647) {
    out.sdpMLineIndex = idx;
  }

  return out;
}
