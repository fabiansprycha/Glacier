import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../core/config';
import type { PlayerStats } from '../core/stats';
import { PAL } from '../gfx/pixels';
import { hiDpi } from './ui/hiDpi';

export interface ShopOffer {
  name: string;
  desc: string;
  price: number;
  sold: boolean;
}

export interface ShopData {
  offers: ShopOffer[];
  stats: Readonly<PlayerStats>;
  /** Tries to buy offer `index`; returns the message to show. */
  onBuy: (index: number) => string;
  onClose: () => void;
}

const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;
const ROW_H = 44;

/** Vending machine menu over the paused game: W/S to choose, Space to buy, Esc or the last row to leave. */
export class ShopScene extends Phaser.Scene {
  private data_!: ShopData;
  private selected = 0;
  private rows: { bg: Phaser.GameObjects.Rectangle; title: Phaser.GameObjects.Text; desc: Phaser.GameObjects.Text }[] = [];
  private plnText!: Phaser.GameObjects.Text;
  private message!: Phaser.GameObjects.Text;

  constructor() {
    super('shop');
  }

  create(data: ShopData): void {
    hiDpi(this);
    this.data_ = data;
    this.selected = 0;
    const cx = VIEW_W / 2;
    const w = 400;
    const h = 60 + (data.offers.length + 1) * ROW_H + 14;
    const top = VIEW_H / 2 - h / 2;

    this.add.rectangle(cx, VIEW_H / 2, VIEW_W, VIEW_H, color(PAL.black), 0.65);
    this.add.rectangle(cx, VIEW_H / 2, w, h, color(PAL.purple)).setStrokeStyle(2, color(PAL.red));
    this.add.text(cx - w / 2 + 14, top + 12, 'VENDING MACHINE', { fontFamily: 'monospace', fontSize: '16px', color: PAL.yellow });
    this.plnText = this.add
      .text(cx + w / 2 - 14, top + 14, '', { fontFamily: 'monospace', fontSize: '12px', color: PAL.white })
      .setOrigin(1, 0);

    const labels = [...data.offers.map((o) => o), { name: 'Leave', desc: 'Esc closes the machine too', price: 0, sold: false }];
    this.rows = labels.map((_, i) => {
      const y = top + 46 + i * ROW_H;
      const bg = this.add.rectangle(cx, y + ROW_H / 2 - 4, w - 20, ROW_H - 6, color(PAL.slate)).setStrokeStyle(1, color(PAL.grey));
      const title = this.add.text(cx - w / 2 + 20, y, '', { fontFamily: 'monospace', fontSize: '13px', color: PAL.white });
      const desc = this.add.text(cx - w / 2 + 20, y + 17, '', { fontFamily: 'monospace', fontSize: '10px', color: PAL.silver });
      return { bg, title, desc };
    });
    this.message = this.add
      .text(cx, top + h - 18, 'W/S choose · Space buy', { fontFamily: 'monospace', fontSize: '11px', color: PAL.silver })
      .setOrigin(0.5);
    this.refresh();

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
  }

  private onKey(e: KeyboardEvent): void {
    const count = this.rows.length;
    const k = e.key.toLowerCase();
    if (k === 'w' || e.key === 'ArrowUp') this.selected = (this.selected + count - 1) % count;
    else if (k === 's' || e.key === 'ArrowDown') this.selected = (this.selected + 1) % count;
    else if (e.key === 'Escape') return this.close();
    else if (e.key === ' ') {
      if (this.selected === count - 1) return this.close();
      this.message.setText(this.data_.onBuy(this.selected));
    } else return;
    this.refresh();
  }

  private refresh(): void {
    const { offers, stats } = this.data_;
    this.plnText.setText(`Wallet: ${stats.pln} PLN`);
    this.rows.forEach((row, i) => {
      const offer = offers[i];
      const active = i === this.selected;
      row.bg.setFillStyle(color(active ? PAL.navy : PAL.slate)).setStrokeStyle(active ? 2 : 1, color(active ? PAL.yellow : PAL.grey));
      if (!offer) {
        row.title.setText('Leave').setColor(PAL.white);
        row.desc.setText('Esc closes the machine too');
        return;
      }
      const affordable = stats.pln >= offer.price;
      row.title
        .setText(offer.sold ? `${offer.name} (sold out)` : `${offer.name}  ·  ${offer.price} PLN`)
        .setColor(offer.sold ? PAL.grey : affordable ? PAL.white : PAL.orange);
      row.desc.setText(offer.desc).setColor(offer.sold ? PAL.grey : PAL.silver);
    });
  }

  private close(): void {
    this.scene.stop();
    this.data_.onClose();
  }
}
