import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from './core/config';
import { BootScene } from './scenes/BootScene';
import { CaptchaScene } from './scenes/CaptchaScene';
import { GameScene } from './scenes/GameScene';
import { ShopScene } from './scenes/ShopScene';
import { InventoryScene } from './scenes/InventoryScene';
import { UIScene } from './scenes/UIScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW_W,
  height: VIEW_H,
  pixelArt: true,
  backgroundColor: '#1a1c2c',
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, GameScene, UIScene, CaptchaScene, ShopScene, InventoryScene],
});

// Debug handle for the browser console and automated tests.
(window as unknown as { game: Phaser.Game }).game = game;
