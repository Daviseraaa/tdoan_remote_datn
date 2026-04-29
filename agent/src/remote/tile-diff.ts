export interface DirtyTileSummary {
  dirtyTiles: number;
  totalTiles: number;
  dirtyRatio: number;
  rects: Array<{ x: number; y: number; w: number; h: number }>;
}

export function computeDirtyTiles(
  prev: Uint8Array | null,
  curr: Uint8Array,
  width: number,
  height: number,
  tileSize: number,
  threshold: number,
): DirtyTileSummary {
  const ts = Math.max(8, tileSize | 0);
  const tilesX = Math.ceil(width / ts);
  const tilesY = Math.ceil(height / ts);
  const totalTiles = tilesX * tilesY;
  if (!prev || prev.length !== curr.length) {
    return {
      dirtyTiles: totalTiles,
      totalTiles,
      dirtyRatio: 1,
      rects: [{ x: 0, y: 0, w: width, h: height }],
    };
  }

  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
  let dirtyTiles = 0;
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = tx * ts;
      const y0 = ty * ts;
      const x1 = Math.min(width, x0 + ts);
      const y1 = Math.min(height, y0 + ts);
      const avgDiff = tileAvgAbsDiff(prev, curr, width, x0, y0, x1, y1);
      if (avgDiff >= threshold) {
        dirtyTiles++;
        rects.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      }
    }
  }
  return {
    dirtyTiles,
    totalTiles,
    dirtyRatio: totalTiles > 0 ? dirtyTiles / totalTiles : 0,
    rects,
  };
}

function tileAvgAbsDiff(
  prev: Uint8Array,
  curr: Uint8Array,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): number {
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      sum += Math.abs(curr[i]! - prev[i]!);
      sum += Math.abs(curr[i + 1]! - prev[i + 1]!);
      sum += Math.abs(curr[i + 2]! - prev[i + 2]!);
      n += 3;
    }
  }
  return n > 0 ? sum / n : 0;
}
