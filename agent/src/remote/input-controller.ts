import { Button, Point } from '@nut-tree-fork/shared';
import { mouse, keyboard, screen, clipboard } from '@nut-tree-fork/nut-js';
import { config } from '../config';
import { logger } from '../logger';

export type RemoteControlPayload = Record<string, unknown>;

function toBtn(b: unknown): Button {
  if (b === 'right') return Button.RIGHT;
  if (b === 'middle') return Button.MIDDLE;
  return Button.LEFT;
}

function mapPoint(
  x: number,
  y: number,
  refW: number,
  refH: number,
  sw: number,
  sh: number,
): Point {
  const px = Math.min(sw - 1, Math.max(0, Math.round((x / refW) * sw)));
  const py = Math.min(sh - 1, Math.max(0, Math.round((y / refH) * sh)));
  return { x: px, y: py };
}

interface ScreenDims {
  w: number;
  h: number;
  at: number;
}

let screenCache: ScreenDims | null = null;

async function getScreenDims(): Promise<{ sw: number; sh: number }> {
  const ttl = config.remote.screenCacheMs;
  const now = Date.now();
  if (screenCache && now - screenCache.at < ttl) {
    return { sw: screenCache.w, sh: screenCache.h };
  }
  const sw = await screen.width();
  const sh = await screen.height();
  screenCache = { w: sw, h: sh, at: now };
  return { sw, sh };
}

export function invalidateScreenCache(): void {
  screenCache = null;
}

export async function applyRemoteControl(msg: RemoteControlPayload): Promise<void> {
  const type = String(msg.type || '');
  const { sw, sh } = await getScreenDims();

  try {
    switch (type) {
      case 'MOUSE_MOVE': {
        const x = Number(msg.x);
        const y = Number(msg.y);
        const rw = Number(msg.screenWidth) || sw;
        const rh = Number(msg.screenHeight) || sh;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        await mouse.setPosition(mapPoint(x, y, rw, rh, sw, sh));
        return;
      }
      case 'MOUSE_DOWN': {
        const x = Number(msg.x);
        const y = Number(msg.y);
        const rw = Number(msg.screenWidth) || sw;
        const rh = Number(msg.screenHeight) || sh;
        const btn = toBtn(msg.button);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          await mouse.setPosition(mapPoint(x, y, rw, rh, sw, sh));
        }
        await mouse.pressButton(btn);
        return;
      }
      case 'MOUSE_UP': {
        const btn = toBtn(msg.button);
        await mouse.releaseButton(btn);
        return;
      }
      case 'MOUSE_CLICK': {
        const x = Number(msg.x);
        const y = Number(msg.y);
        const rw = Number(msg.screenWidth) || sw;
        const rh = Number(msg.screenHeight) || sh;
        const btn = toBtn(msg.button);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          await mouse.setPosition(mapPoint(x, y, rw, rh, sw, sh));
        }
        await mouse.click(btn);
        return;
      }
      case 'MOUSE_DRAG': {
        const path = msg.path as unknown;
        if (!Array.isArray(path) || path.length < 2) return;
        const rw = Number(msg.screenWidth) || sw;
        const rh = Number(msg.screenHeight) || sh;
        const pts: Point[] = [];
        for (const p of path) {
          if (!p || typeof p !== 'object') continue;
          const o = p as Record<string, unknown>;
          const x = Number(o.x);
          const y = Number(o.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          pts.push(mapPoint(x, y, rw, rh, sw, sh));
        }
        if (pts.length >= 2) await mouse.drag(pts);
        return;
      }
      case 'MOUSE_WHEEL': {
        const dy = Number(msg.deltaY) || 0;
        const dx = Number(msg.deltaX) || 0;
        const steps = Math.min(25, Math.max(1, Math.ceil(Math.abs(dy) / 50)));
        if (dy > 0) await mouse.scrollDown(steps);
        else if (dy < 0) await mouse.scrollUp(steps);
        const hSteps = Math.min(25, Math.max(1, Math.ceil(Math.abs(dx) / 50)));
        if (dx > 0) await mouse.scrollRight(hSteps);
        else if (dx < 0) await mouse.scrollLeft(hSteps);
        return;
      }
      case 'TEXT': {
        const text = String(msg.text ?? '');
        if (!text || text.length > 4000) return;
        await keyboard.type(text);
        return;
      }
      case 'CLIPBOARD': {
        const text = String(msg.text ?? '');
        if (!text || text.length > 32_000) return;
        await clipboard.setContent(text);
        return;
      }
      default:
        return;
    }
  } catch (err) {
    logger.warn({ err, type }, 'remote control failed');
  }
}
