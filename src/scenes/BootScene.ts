import Phaser from 'phaser';
import { CLASS_IDS } from '../core/classes';
import { LEVELS } from '../core/levels';
import { createTextures } from '../gfx/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  create(): void {
    createTextures(this);
    // ?seed=42 replays a layout, ?level=3 starts on a later level (handy for testing bosses).
    const params = new URLSearchParams(location.search);
    const num = (name: string) => (/^\d+$/.test(params.get(name) ?? '') ? Number(params.get(name)) : undefined);
    const seed = num('seed');
    const level = Phaser.Math.Clamp(num('level') ?? 1, 1, LEVELS.length);
    // A seed or level in the URL skips the title screen (handy for testing); otherwise show the menu.
    if (seed === undefined && !params.has('level')) {
      this.scene.start('menu');
      return;
    }
    // HUD first, so it is listening before the first level is announced.
    this.scene.launch('ui');
    // ?class=qa picks the role when skipping the menu (dev by default).
    const cls = params.get('class');
    const heroClass = CLASS_IDS.find((id) => id === cls) ?? 'dev';
    this.scene.start('game', { seed, level, heroClass });
  }
}
