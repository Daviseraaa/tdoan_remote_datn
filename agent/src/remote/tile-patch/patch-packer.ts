/** Binary tile patch format (little-endian). See docs/project-memory/05-realtime-architecture.md */

export const TILE_PATCH_VERSION = 1;
export const TILE_PATCH_CHANNEL_LABEL = 'tilepatch';

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PackTilePatchOptions {
  frameId: number;
  screenWidth: number;
  screenHeight: number;
  tileSize: number;
  /** Full RGBA framebuffer, row-major, length >= screenWidth*screenHeight*4 */
  rgba: Uint8Array;
  rects: TileRect[];
  maxTiles: number;
}

/** Header size: 1 + 4 + 2 + 2 + 2 + 2 = 13 */
const HEADER_LEN = 13;
const TILE_META_LEN = 12;

/**
 * Returns packed buffer or null if nothing to send (no rects after clamp).
 */
export function packTilePatchMessage(opts: PackTilePatchOptions): Buffer | null {
  const { frameId, screenWidth, screenHeight, tileSize, rgba, rects, maxTiles } = opts;
  if (!rects.length) return null;
  const mt = Math.max(1, maxTiles | 0);
  if (rects.length > mt) return null;
  const useRects = rects;

  let totalPayload = 0;
  for (const r of useRects) {
    totalPayload += r.w * r.h * 4;
  }

  const buf = Buffer.allocUnsafe(HEADER_LEN + useRects.length * TILE_META_LEN + totalPayload);
  let o = 0;
  buf.writeUInt8(TILE_PATCH_VERSION, o);
  o += 1;
  buf.writeUInt32LE(frameId >>> 0, o);
  o += 4;
  buf.writeUInt16LE(useRects.length & 0xffff, o);
  o += 2;
  buf.writeUInt16LE(screenWidth & 0xffff, o);
  o += 2;
  buf.writeUInt16LE(screenHeight & 0xffff, o);
  o += 2;
  buf.writeUInt16LE(Math.min(65535, Math.max(1, tileSize | 0)) & 0xffff, o);
  o += 2;

  const stride = screenWidth * 4;
  for (const r of useRects) {
    buf.writeUInt16LE(r.x & 0xffff, o);
    o += 2;
    buf.writeUInt16LE(r.y & 0xffff, o);
    o += 2;
    buf.writeUInt16LE(r.w & 0xffff, o);
    o += 2;
    buf.writeUInt16LE(r.h & 0xffff, o);
    o += 2;
    const payloadLen = r.w * r.h * 4;
    buf.writeUInt32LE(payloadLen >>> 0, o);
    o += 4;
    copyRgbaRegion(rgba, screenWidth, screenHeight, r, buf, o);
    o += payloadLen;
  }

  return buf;
}

function copyRgbaRegion(
  src: Uint8Array,
  screenWidth: number,
  screenHeight: number,
  r: TileRect,
  dst: Buffer,
  dstOff: number,
) {
  const { x, y, w, h } = r;
  if (x < 0 || y < 0 || w <= 0 || h <= 0) return;
  if (x + w > screenWidth || y + h > screenHeight) return;
  const srcStride = screenWidth * 4;
  let out = dstOff;
  for (let row = 0; row < h; row++) {
    const srcRow = (y + row) * srcStride + x * 4;
    const len = w * 4;
    dst.set(src.subarray(srcRow, srcRow + len), out);
    out += len;
  }
}
