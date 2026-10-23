import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../core/config';
import { PAL } from '../gfx/pixels';
import { hiDpi } from './ui/hiDpi';

export interface CaptchaData {
  length: number;
  timeMs: number;
  onDone: (passed: boolean) => void;
}

const KEYS = ['W', 'A', 'S', 'D'] as const;
const ARROW_TO_KEY: Record<string, string> = { ArrowUp: 'W', ArrowLeft: 'A', ArrowDown: 'S', ArrowRight: 'D' };
const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

/**
 * Glacier's reverse CAPTCHA: "prove you're a bot". The player must type a key sequence
 * faster than a human comfortably can. One wrong key or running out of time fails it.
 * Runs on top of the paused game scene and reports back through `onDone`.
 */
export class CaptchaScene extends Phaser.Scene {
  private sequence: string[] = [];
  private typed = 0;
  private boxes: { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];
  private timer!: Phaser.GameObjects.Graphics;
  private status!: Phaser.GameObjects.Text;
  private deadline = 0;
  private timeMs = 0;
  private finished = false;
  private onDone!: (passed: boolean) => void;

  constructor() {
    super('captcha');
  }

  create(data: CaptchaData): void {
    hiDpi(this);
    this.sequence = Array.from({ length: data.length }, () => Phaser.Utils.Array.GetRandom([...KEYS]));
    this.typed = 0;
    this.finished = false;
    this.onDone = data.onDone;
    this.timeMs = data.timeMs;

    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;
    const w = 380;
    const h = 210;
    this.add.rectangle(cx, cy, VIEW_W, VIEW_H, color(PAL.black), 0.65);
    this.add.rectangle(cx, cy, w, h, color(PAL.navy)).setStrokeStyle(2, color(PAL.cyan));
    const text = (y: number, s: string, size: number, fill: string) =>
      this.add
        .text(cx, y, s, { fontFamily: 'monospace', fontSize: `${size}px`, color: fill, align: 'center', wordWrap: { width: w - 30 } })
        .setOrigin(0.5);
    text(cy - 78, 'PROVE YOU ARE A BOT', 16, PAL.cyan);
    text(cy - 52, 'Glacier is verifying the user. Type the sequence before time runs out. Humans are too slow.', 10, PAL.silver);

    const size = 30;
    const gap = 8;
    const total = this.sequence.length * size + (this.sequence.length - 1) * gap;
    this.boxes = this.sequence.map((k, i) => {
      const x = cx - total / 2 + size / 2 + i * (size + gap);
      const bg = this.add.rectangle(x, cy, size, size, color(PAL.slate)).setStrokeStyle(2, color(PAL.grey));
      const label = this.add.text(x, cy, k, { fontFamily: 'monospace', fontSize: '18px', color: PAL.white }).setOrigin(0.5);
      return { bg, label };
    });

    this.timer = this.add.graphics();
    this.status = text(cy + 70, 'WSAD', 12, PAL.yellow);
    // The clock of a freshly launched scene only starts ticking on its first update.
    this.deadline = 0;

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => this.onKey(e));
  }

  update(): void {
    if (this.finished) return;
    if (this.deadline === 0) this.deadline = this.time.now + this.timeMs;
    const left = Math.max(0, this.deadline - this.time.now);
    const w = 300;
    const x = VIEW_W / 2 - w / 2;
    const y = VIEW_H / 2 + 34;
    this.timer.clear().fillStyle(color(PAL.black)).fillRect(x, y, w, 8);
    this.timer.fillStyle(color(left < this.timeMs / 3 ? PAL.red : PAL.cyan)).fillRect(x, y, (w * left) / this.timeMs, 8);
    if (left === 0) this.finish(false);
  }

  private onKey(e: KeyboardEvent): void {
    if (this.finished) return;
    const key = ARROW_TO_KEY[e.key] ?? e.key.toUpperCase();
    if (!(KEYS as readonly string[]).includes(key)) return;
    if (key !== this.sequence[this.typed]) {
      this.boxes[this.typed].bg.setFillStyle(color(PAL.red));
      this.finish(false);
      return;
    }
    this.boxes[this.typed].bg.setFillStyle(color(PAL.green));
    this.typed++;
    if (this.typed === this.sequence.length) this.finish(true);
  }

  private finish(passed: boolean): void {
    this.finished = true;
    this.status
      .setText(passed ? 'VERIFICATION PASSED. Welcome, bot.' : 'HUMAN DETECTED. ALARM!')
      .setColor(passed ? PAL.lime : PAL.red);
    this.time.delayedCall(900, () => {
      this.scene.stop();
      this.onDone(passed);
    });
  }
}
