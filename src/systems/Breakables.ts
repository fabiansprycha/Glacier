import Phaser from 'phaser';
import { TILE } from '../core/config';
import { PAL } from '../gfx/pixels';
import { BREAKABLE, T } from '../world/tiles';

const DEBRIS: Partial<Record<number, string[]>> = {
  [T.PLANT]: [PAL.orange, PAL.teal, PAL.yellow],
  [T.FLOWERS]: [PAL.sky, PAL.green, PAL.red, PAL.yellow],
  [T.BOXES]: [PAL.orange, PAL.purple, PAL.white],
  [T.CHAIR]: [PAL.navy, PAL.grey, PAL.silver],
  [T.WALL_CRACKED]: [PAL.grey, PAL.silver, PAL.slate],
};

const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

/** Clutter (and cracked walls) that the badge and pens can smash. Tracks hits per tile. */
export class Breakables {
  private hits = new Map<string, number>();

  constructor(
    private readonly scene: Phaser.Scene,
    /** Layers to look in, furniture first; the base layer holds cracked walls. */
    private readonly layers: Phaser.Tilemaps.TilemapLayer[],
    private readonly onBroken: (tile: number, tx: number, ty: number) => void,
  ) {}

  /** Hits every breakable tile touching the circle. True when something was hit. */
  hitCircle(x: number, y: number, radius: number): boolean {
    let hit = false;
    for (let ty = Math.floor((y - radius) / TILE); ty <= Math.floor((y + radius) / TILE); ty++) {
      for (let tx = Math.floor((x - radius) / TILE); tx <= Math.floor((x + radius) / TILE); tx++) {
        const found = this.find(tx, ty);
        if (!found) continue;
        const { tile, layer } = found;
        const nearestX = Phaser.Math.Clamp(x, tx * TILE, tx * TILE + TILE);
        const nearestY = Phaser.Math.Clamp(y, ty * TILE, ty * TILE + TILE);
        if (Phaser.Math.Distance.Between(x, y, nearestX, nearestY) > radius) continue;
        this.hitTile(layer, tile.index, tx, ty);
        hit = true;
      }
    }
    return hit;
  }

  private find(tx: number, ty: number): { tile: Phaser.Tilemaps.Tile; layer: Phaser.Tilemaps.TilemapLayer } | null {
    for (const layer of this.layers) {
      const tile = layer.getTileAt(tx, ty);
      if (tile && BREAKABLE[tile.index] !== undefined) return { tile, layer };
    }
    return null;
  }

  private hitTile(layer: Phaser.Tilemaps.TilemapLayer, index: number, tx: number, ty: number): void {
    const key = `${tx},${ty}`;
    const count = (this.hits.get(key) ?? 0) + 1;
    const broken = count >= BREAKABLE[index]!;
    this.debris(index, tx, ty, broken ? 10 : 3);
    if (!broken) {
      this.hits.set(key, count);
      return;
    }
    this.hits.delete(key);
    layer.removeTileAt(tx, ty);
    this.onBroken(index, tx, ty);
  }

  private debris(index: number, tx: number, ty: number, count: number): void {
    const colors = DEBRIS[index] ?? [PAL.grey];
    const cx = tx * TILE + TILE / 2;
    const cy = ty * TILE + TILE / 2;
    for (let i = 0; i < count; i++) {
      const bit = this.scene.add.rectangle(cx, cy, 2, 2, color(colors[i % colors.length])).setDepth(9500);
      const angle = Math.random() * Math.PI * 2;
      const dist = 6 + Math.random() * 10;
      this.scene.tweens.add({
        targets: bit,
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        alpha: 0,
        duration: 300 + Math.random() * 200,
        ease: 'Quad.out',
        onComplete: () => bit.destroy(),
      });
    }
  }
}
