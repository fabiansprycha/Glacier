import { TILE } from '../core/config';
import type { SecurityCamera } from './dungeon';

/** View distance in pixels. */
export const CAMERA_RANGE = 110;
/** Half the width of the vision cone. */
export const CAMERA_HALF_FOV = 0.32;
/** How far the camera turns to each side of its resting direction. */
export const CAMERA_SWEEP = 0.95;
/** The sprite sits this far off its wall tile, towards the room. */
export const CAMERA_NUDGE = 4;

/** Camera lens position in room-local pixels. */
export function cameraLens(cam: SecurityCamera): { x: number; y: number } {
  return {
    x: cam.x * TILE + TILE / 2 + Math.cos(cam.facing) * CAMERA_NUDGE,
    y: cam.y * TILE + TILE / 2 + Math.sin(cam.facing) * CAMERA_NUDGE,
  };
}

/**
 * True when any part of a room-local tile can fall inside the cone at some point of the sweep.
 * Checks the tile's corners and center with a small margin, so "outside" really means safe.
 */
export function cameraCanSeeTile(cam: SecurityCamera, tx: number, ty: number): boolean {
  const lens = cameraLens(cam);
  const reach = CAMERA_HALF_FOV + CAMERA_SWEEP + 0.08;
  for (const [ox, oy] of [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]]) {
    const dx = (tx + ox) * TILE - lens.x;
    const dy = (ty + oy) * TILE - lens.y;
    if (Math.hypot(dx, dy) > CAMERA_RANGE + 4) continue;
    let diff = Math.atan2(dy, dx) - cam.facing;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) < reach) return true;
  }
  return false;
}
