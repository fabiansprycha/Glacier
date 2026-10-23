import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../core/config';
import { PAL } from '../gfx/pixels';
import type { LoreNote } from '../world/lore';
import { hiDpi } from './ui/hiDpi';

export interface NoteData {
  note: LoreNote;
  /** Emails show in a mail window, sticky notes on a yellow square of paper. */
  kind: 'email' | 'note';
  onClose: () => void;
}

const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;
/** The Space press that opened the note must not close it straight away. */
const OPEN_GUARD_MS = 200;

/** An email or sticky note found while searching, over the paused game. Space, Enter or Esc closes it. */
export class NoteScene extends Phaser.Scene {
  constructor() {
    super('note');
  }

  create(data: NoteData): void {
    hiDpi(this);
    const cx = VIEW_W / 2;
    const cy = VIEW_H / 2;
    this.add.rectangle(cx, cy, VIEW_W, VIEW_H, color(PAL.black), 0.7);

    if (data.kind === 'email') {
      const w = 300;
      const h = 150;
      const left = cx - w / 2;
      const top = cy - h / 2;
      this.add.rectangle(cx, cy, w, h, color(PAL.white)).setStrokeStyle(2, color(PAL.slate));
      this.add.rectangle(cx, top + 9, w, 18, color(PAL.blue));
      this.add.text(left + 8, top + 3, 'Inbox · 1 unread', { fontFamily: 'monospace', fontSize: '10px', color: PAL.white });
      this.add.text(left + 10, top + 26, data.note.title, { fontFamily: 'monospace', fontSize: '11px', color: PAL.navy, fontStyle: 'bold' });
      this.add.rectangle(cx, top + 42, w - 20, 1, color(PAL.silver));
      this.add.text(left + 10, top + 50, data.note.text, {
        fontFamily: 'monospace', fontSize: '10px', color: PAL.black, wordWrap: { width: w - 20 }, lineSpacing: 2,
      });
      this.add.text(left + w - 8, top + h - 6, 'Space / Esc close', { fontFamily: 'monospace', fontSize: '9px', color: PAL.grey }).setOrigin(1, 1);
    } else {
      const size = 170;
      const paper = this.add.container(cx, cy, [
        this.add.rectangle(3, 4, size, size, color(PAL.black), 0.35),
        this.add.rectangle(0, 0, size, size, color(PAL.yellow)),
        this.add.rectangle(0, -size / 2 + 8, size, 16, color(PAL.orange), 0.35),
        this.add.text(0, 6, data.note.text, {
          fontFamily: 'monospace', fontSize: '11px', color: PAL.slate, align: 'center', wordWrap: { width: size - 24 }, lineSpacing: 3,
        }).setOrigin(0.5),
      ]);
      paper.setAngle(-2);
      this.add.text(cx, cy + size / 2 + 14, 'Space / Esc close', { fontFamily: 'monospace', fontSize: '9px', color: PAL.silver }).setOrigin(0.5);
    }

    const openedAt = performance.now();
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (performance.now() - openedAt < OPEN_GUARD_MS) return;
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        this.scene.stop();
        data.onClose();
      }
    });
  }
}
