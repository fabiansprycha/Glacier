import Phaser from 'phaser';
import { PAL } from '../../gfx/pixels';

export interface MenuItem {
  label: string;
  action: () => void;
}

const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

/** Vertical keyboard menu: W/S or arrows to move, Space or Enter to choose. */
export class MenuList {
  private selected = 0;
  private readonly rows: { bg: Phaser.GameObjects.Rectangle; text: Phaser.GameObjects.Text }[];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly items: MenuItem[],
    width = 180,
    rowH = 26,
  ) {
    this.rows = items.map((item, i) => {
      const cy = y + i * rowH;
      const bg = scene.add.rectangle(x, cy, width, rowH - 6, color(PAL.slate), 0.85);
      const text = scene.add
        .text(x, cy, item.label, { fontFamily: 'monospace', fontSize: '13px', color: PAL.white })
        .setOrigin(0.5);
      return { bg, text };
    });
    this.refresh();
    scene.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
  }

  private onKey(e: KeyboardEvent): void {
    const n = this.items.length;
    const k = e.key.toLowerCase();
    if (k === 'w' || e.key === 'ArrowUp') this.selected = (this.selected + n - 1) % n;
    else if (k === 's' || e.key === 'ArrowDown') this.selected = (this.selected + 1) % n;
    else if (e.key === ' ' || e.key === 'Enter') return this.items[this.selected].action();
    else return;
    this.refresh();
  }

  private refresh(): void {
    this.rows.forEach(({ bg, text }, i) => {
      const active = i === this.selected;
      bg.setFillStyle(color(active ? PAL.navy : PAL.slate), 0.85).setStrokeStyle(active ? 2 : 1, color(active ? PAL.cyan : PAL.grey));
      text.setColor(active ? PAL.cyan : PAL.white).setText(active ? `> ${this.items[i].label} <` : this.items[i].label);
    });
  }
}

/** Every key the game uses, for the "How to play" panels. */
export const CONTROLS_TEXT = [
  'WSAD / arrows   move',
  'J               swing the badge',
  'K               throw a pen',
  'Space           search, use',
  'I / Tab         inventory',
  'Esc / P         pause',
].join('\n');
