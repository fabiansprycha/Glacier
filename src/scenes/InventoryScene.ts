import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../core/config';
import { CLASSES } from '../core/classes';
import { ITEMS } from '../core/items';
import type { PlayerStats } from '../core/stats';
import { PAL } from '../gfx/pixels';
import { hiDpi } from './ui/hiDpi';

export interface InventoryData {
  stats: Readonly<PlayerStats>;
  onClose: () => void;
}

const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;
const COLS = 2;
const ROW_H = 36;

/** Inventory over the paused game: stats and every item with what it does. I, Tab or Esc closes it. */
export class InventoryScene extends Phaser.Scene {
  private data_!: InventoryData;

  constructor() {
    super('inventory');
  }

  create(data: InventoryData): void {
    hiDpi(this);
    this.data_ = data;
    const { stats } = data;
    const cx = VIEW_W / 2;
    const w = VIEW_W - 40;
    const rows = Math.max(1, Math.ceil(stats.items.length / COLS));
    const h = 78 + rows * ROW_H + 10;
    const top = VIEW_H / 2 - h / 2;
    const left = cx - w / 2;

    this.add.rectangle(cx, VIEW_H / 2, VIEW_W, VIEW_H, color(PAL.black), 0.65);
    this.add.rectangle(cx, VIEW_H / 2, w, h, color(PAL.navy)).setStrokeStyle(2, color(PAL.cyan));
    this.add.text(left + 12, top + 10, `INVENTORY · ${CLASSES[stats.heroClass].name.toUpperCase()}`, { fontFamily: 'monospace', fontSize: '16px', color: PAL.cyan });
    this.add
      .text(left + w - 12, top + 13, 'I / Esc close', { fontFamily: 'monospace', fontSize: '10px', color: PAL.silver })
      .setOrigin(1, 0);
    this.add.text(
      left + 12,
      top + 34,
      `HP ${stats.hp}/${stats.maxHp} · Pens ${stats.pens}/${stats.maxPens} · ${stats.pln} PLN\n` +
        `Badge damage ${stats.meleeDamage} · Pen damage ${stats.rangedDamage}`,
      { fontFamily: 'monospace', fontSize: '11px', color: PAL.white, lineSpacing: 2 },
    );

    const colW = (w - 24) / COLS;
    if (stats.items.length === 0) {
      this.add.text(left + 12, top + 72, 'No items yet. Search furniture, beat bosses or try a vending machine.', {
        fontFamily: 'monospace', fontSize: '10px', color: PAL.silver, wordWrap: { width: w - 24 },
      });
    }
    stats.items.forEach((id, i) => {
      const x = left + 12 + (i % COLS) * colW;
      const y = top + 72 + Math.floor(i / COLS) * ROW_H;
      this.add.text(x, y, ITEMS[id].name, { fontFamily: 'monospace', fontSize: '11px', color: PAL.yellow });
      this.add.text(x, y + 13, ITEMS[id].desc, {
        fontFamily: 'monospace', fontSize: '9px', color: PAL.silver, wordWrap: { width: colW - 8 },
      });
    });

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Tab' || e.key.toLowerCase() === 'i') {
        e.preventDefault();
        this.scene.stop();
        this.data_.onClose();
      }
    });
  }
}
