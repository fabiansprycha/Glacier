import Phaser from 'phaser';
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
    // HUD first, so it is listening before the first level is announced.
    this.scene.launch('ui');
    this.scene.start('game', { seed, level });
  }
}
