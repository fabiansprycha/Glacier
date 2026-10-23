import Phaser from 'phaser';
import { TILE } from '../core/config';
import type { Player } from '../entities/Player';
import { SEARCHABLE } from '../world/tiles';

export interface SearchTarget {
  tx: number;
  ty: number;
  tile: number;
}

/** Max distance from the player's feet to the furniture's edge. */
const REACH = 12;
const SEARCH_MS = 550;

/** Finds furniture next to the player and runs the timed search with a progress bar. */
export class Search {
  private bar: Phaser.GameObjects.Graphics;
  busy = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly props: Phaser.Tilemaps.TilemapLayer,
  ) {
    this.bar = scene.add.graphics().setDepth(20000);
  }

  /** Closest matching furniture tile (searchable by default) whose edge is within reach of the player's feet, preferring the aim direction. */
  findTarget(player: Player, accept: (tile: number) => boolean = (t) => SEARCHABLE[t] !== undefined): SearchTarget | null {
    const feet = player.feet;
    const probe = feet.clone().add(player.aim.clone().scale(6));
    let best: SearchTarget | null = null;
    let bestDist = Infinity;
    const cx = Math.floor(feet.x / TILE);
    const cy = Math.floor(feet.y / TILE);
    for (let ty = cy - 1; ty <= cy + 1; ty++) {
      for (let tx = cx - 1; tx <= cx + 1; tx++) {
        const tile = this.props.getTileAt(tx, ty);
        if (!tile || !accept(tile.index)) continue;
        const nearestX = Phaser.Math.Clamp(feet.x, tx * TILE, tx * TILE + TILE);
        const nearestY = Phaser.Math.Clamp(feet.y, ty * TILE, ty * TILE + TILE);
        if (Phaser.Math.Distance.Between(feet.x, feet.y, nearestX, nearestY) > REACH) continue;
        const d = Phaser.Math.Distance.Between(probe.x, probe.y, tx * TILE + TILE / 2, ty * TILE + TILE / 2);
        if (d < bestDist) {
          bestDist = d;
          best = { tx, ty, tile: tile.index };
        }
      }
    }
    return best;
  }

  /** Searches the target; `done` runs once the bar fills. The furniture switches to its emptied look. */
  start(target: SearchTarget, done: (target: SearchTarget) => void): void {
    this.busy = true;
    const x = target.tx * TILE;
    const y = target.ty * TILE - 5;
    const progress = { t: 0 };
    this.scene.tweens.add({
      targets: progress,
      t: 1,
      duration: SEARCH_MS,
      onUpdate: () => {
        this.bar.clear().fillStyle(0x1a1c2c).fillRect(x, y, TILE, 3).fillStyle(0xa7f070).fillRect(x + 1, y + 1, (TILE - 2) * progress.t, 1);
      },
      onComplete: () => {
        this.bar.clear();
        this.props.putTileAt(SEARCHABLE[target.tile]!, target.tx, target.ty);
        this.busy = false;
        done(target);
      },
    });
  }
}
