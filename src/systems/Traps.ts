import Phaser from 'phaser';
import { ROOM_H, ROOM_W, TILE } from '../core/config';
import type { Player } from '../entities/Player';
import { TEX } from '../gfx/textures';
import type { Room } from '../world/dungeon';

/** Cycle of an electrified plate, in ms: off, then sparks as a warning, then live. */
const OFF_MS = 1400;
const WARN_MS = 600;
const ON_MS = 700;
const CYCLE = OFF_MS + WARN_MS + ON_MS;

interface Trap {
  room: Room;
  sprite: Phaser.GameObjects.Image;
  /** Phase offset so plates in one room do not all fire together. */
  offset: number;
}

/** Floor traps: torn cables under electrified plates. Only the player's current room is simulated. */
export class Traps {
  private traps: Trap[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly onShock: (from: Phaser.Math.Vector2) => void,
  ) {}

  add(room: Room, tx: number, ty: number): void {
    const x = (room.gx * ROOM_W + tx) * TILE + TILE / 2;
    const y = (room.gy * ROOM_H + ty) * TILE + TILE / 2;
    const sprite = this.scene.add.image(x, y, TEX.trap, 'off').setDepth(-998);
    this.traps.push({ room, sprite, offset: (tx * 7 + ty * 13) * 97 });
  }

  update(room: Room): void {
    const now = this.scene.time.now;
    const feet = this.player.feet;
    for (const trap of this.traps) {
      if (trap.room !== room) continue;
      const t = (now + trap.offset) % CYCLE;
      const state = t < OFF_MS ? 'off' : t < OFF_MS + WARN_MS ? 'warn' : 'on';
      trap.sprite.setFrame(state);
      if (state !== 'on') continue;
      const s = trap.sprite;
      if (Math.abs(feet.x - s.x) < 8 && Math.abs(feet.y - s.y) < 8) this.onShock(new Phaser.Math.Vector2(s.x, s.y));
    }
  }
}
