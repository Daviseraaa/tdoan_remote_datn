/** Decode binary tile patches (agent/src/remote/tile-patch/patch-packer.ts) */

export const TILE_PATCH_CHANNEL_LABEL = 'tilepatch';

export type DecodedTilePatch = {
  version: number;
  frameId: number;
  tileCount: number;
  screenWidth: number;
  screenHeight: number;
  tileSize: number;
  tiles: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    data: Uint8Array;
  }>;
};

const HEADER_LEN = 13;

/**
 * Decode one binary message; returns null if malformed.
 */
export function decodeTilePatchMessage(buf: ArrayBuffer): DecodedTilePatch | null {
  if (buf.byteLength < HEADER_LEN) return null;
  const dv = new DataView(buf);
  let o = 0;
  const version = dv.getUint8(o);
  o += 1;
  const frameId = dv.getUint32(o, true);
  o += 4;
  const tileCount = dv.getUint16(o, true);
  o += 2;
  const screenWidth = dv.getUint16(o, true);
  o += 2;
  const screenHeight = dv.getUint16(o, true);
  o += 2;
  const tileSize = dv.getUint16(o, true);
  o += 2;

  const tiles: DecodedTilePatch['tiles'] = [];
  for (let i = 0; i < tileCount; i++) {
    if (o + 12 > buf.byteLength) return null;
    const x = dv.getUint16(o, true);
    o += 2;
    const y = dv.getUint16(o, true);
    o += 2;
    const w = dv.getUint16(o, true);
    o += 2;
    const h = dv.getUint16(o, true);
    o += 2;
    const payloadLen = dv.getUint32(o, true);
    o += 4;
    if (payloadLen <= 0 || o + payloadLen > buf.byteLength) return null;
    if (w * h * 4 !== payloadLen) return null;
    const data = new Uint8Array(buf.slice(o, o + payloadLen));
    o += payloadLen;
    tiles.push({ x, y, w, h, data });
  }

  return { version, frameId, tileCount, screenWidth, screenHeight, tileSize, tiles };
}

/**
 * Draw tiles onto a 2D context. Skips if canvas logical size mismatches screen (caller should resize first).
 */
export function applyTilePatchToCanvas(
  ctx: CanvasRenderingContext2D,
  patch: DecodedTilePatch,
  canvasWidth: number,
  canvasHeight: number,
): number {
  if (patch.screenWidth !== canvasWidth || patch.screenHeight !== canvasHeight) return 0;
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  for (const t of patch.tiles) {
    if (t.w <= 0 || t.h <= 0) continue;
    const img = ctx.createImageData(t.w, t.h);
    img.data.set(t.data);
    ctx.putImageData(img, t.x, t.y);
  }
  return typeof performance !== 'undefined' ? performance.now() - t0 : 0;
}
