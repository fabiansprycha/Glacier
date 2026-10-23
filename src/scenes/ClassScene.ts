import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../core/config';
import { CLASSES, CLASS_IDS, type HeroClass } from '../core/classes';
import { randomSeed } from '../core/rng';
import { PAL } from '../gfx/pixels';
import { heroTexture } from '../gfx/textures';
import { Player } from '../entities/Player';
import { hiDpi } from './ui/hiDpi';

const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;
const CARD_W = 108;
const CARD_H = 260;
const GAP = 8;

/** Pick an office role before the run: A/D to browse, Space or Enter to start, Esc to go back. */
export class ClassScene extends Phaser.Scene {
  private selected = 0;
  private cards: { bg: Phaser.GameObjects.Rectangle; hero: Phaser.GameObjects.Sprite; name: Phaser.GameObjects.Text }[] = [];

  constructor() {
    super('classes');
  }

  create(): void {
    hiDpi(this);
    this.selected = 0;
    this.add.text(VIEW_W / 2, 24, 'CHOOSE YOUR ROLE', { fontFamily: 'monospace', fontSize: '18px', color: PAL.cyan }).setOrigin(0.5);

    const total = CLASS_IDS.length * CARD_W + (CLASS_IDS.length - 1) * GAP;
    const left = (VIEW_W - total) / 2;
    const top = 50;
    this.cards = CLASS_IDS.map((id, i) => {
      const def = CLASSES[id];
      const cx = left + i * (CARD_W + GAP) + CARD_W / 2;
      const bg = this.add.rectangle(cx, top + CARD_H / 2, CARD_W, CARD_H, color(PAL.slate));
      Player.createAnims(this, heroTexture(id));
      const hero = this.add.sprite(cx, top + 34, heroTexture(id), 'down-0').setScale(3);
      const name = this.add.text(cx, top + 68, def.name, { fontFamily: 'monospace', fontSize: '12px', color: PAL.white }).setOrigin(0.5, 0);
      const tagline = this.add
        .text(cx, top + 84, def.tagline, { fontFamily: 'monospace', fontSize: '9px', color: PAL.silver, align: 'center', wordWrap: { width: CARD_W - 10 } })
        .setOrigin(0.5, 0);
      this.add.text(cx - CARD_W / 2 + 6, tagline.y + tagline.height + 8, def.perks.map((p) => `+ ${p}`).join('\n'), {
        fontFamily: 'monospace', fontSize: '9px', color: PAL.lime, wordWrap: { width: CARD_W - 12 }, lineSpacing: 1,
      });
      return { bg, hero, name };
    });

    this.add
      .text(VIEW_W / 2, VIEW_H - 14, 'A/D choose · Space or Enter start · Esc back', { fontFamily: 'monospace', fontSize: '10px', color: PAL.grey })
      .setOrigin(0.5);
    this.refresh();

    this.input.keyboard!.on('keydown', (e: KeyboardEvent) => {
      const n = CLASS_IDS.length;
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'w' || e.key === 'ArrowLeft' || e.key === 'ArrowUp') this.selected = (this.selected + n - 1) % n;
      else if (k === 'd' || k === 's' || e.key === 'ArrowRight' || e.key === 'ArrowDown') this.selected = (this.selected + 1) % n;
      else if (e.key === ' ' || e.key === 'Enter') return this.start(CLASS_IDS[this.selected]);
      else if (e.key === 'Escape') return void this.scene.start('menu');
      else return;
      this.refresh();
    });
    this.cameras.main.fadeIn(250);
  }

  private refresh(): void {
    this.cards.forEach(({ bg, hero, name }, i) => {
      const active = i === this.selected;
      bg.setFillStyle(color(active ? PAL.navy : PAL.slate), 0.95).setStrokeStyle(active ? 2 : 1, color(active ? PAL.cyan : PAL.grey));
      name.setColor(active ? PAL.cyan : PAL.white);
      if (active) hero.play(`${heroTexture(CLASS_IDS[i])}-walk-down`, true);
      else hero.stop().setFrame('down-0');
    });
  }

  private start(heroClass: HeroClass): void {
    this.input.keyboard!.removeAllListeners();
    this.cameras.main.fadeOut(300, 26, 28, 44);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      // HUD first, so it is listening before the first level is announced.
      this.scene.launch('ui');
      this.scene.start('game', { seed: randomSeed(), level: 1, heroClass });
    });
  }
}
