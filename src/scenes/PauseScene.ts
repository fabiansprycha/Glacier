import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../core/config';
import { PAL } from '../gfx/pixels';
import { CONTROLS_TEXT, MenuList } from './ui/MenuList';

export interface PauseData {
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
}

const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

/** Pause menu over the frozen game. Esc or P resumes. */
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('pause');
  }

  create(data: PauseData): void {
    const cx = VIEW_W / 2;
    const close = (then: () => void) => {
      this.scene.stop();
      then();
    };
    this.add.rectangle(cx, VIEW_H / 2, VIEW_W, VIEW_H, color(PAL.black), 0.65);
    this.add.rectangle(cx, VIEW_H / 2, 260, 236, color(PAL.navy)).setStrokeStyle(2, color(PAL.cyan));
    this.add.text(cx, VIEW_H / 2 - 100, 'PAUSED', { fontFamily: 'monospace', fontSize: '18px', color: PAL.cyan }).setOrigin(0.5);

    new MenuList(this, cx, VIEW_H / 2 - 66, [
      { label: 'RESUME', action: () => close(data.onResume) },
      { label: 'RESTART RUN', action: () => close(data.onRestart) },
      { label: 'MAIN MENU', action: () => close(data.onMainMenu) },
    ]);
    this.add
      .text(cx - 112, VIEW_H / 2 + 14, CONTROLS_TEXT, { fontFamily: 'monospace', fontSize: '10px', color: PAL.silver, lineSpacing: 3 });

    // The key press that opened the menu can arrive here too; do not let it close the menu at once.
    const openedAt = performance.now();
    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      if (performance.now() - openedAt < 200) return;
      if (e.key === 'Escape' || e.key.toLowerCase() === 'p') close(data.onResume);
    });
  }
}
