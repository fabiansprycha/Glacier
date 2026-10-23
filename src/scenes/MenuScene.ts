import Phaser from 'phaser';
import { VIEW_H, VIEW_W, TILE } from '../core/config';
import { PAL } from '../gfx/pixels';
import { TEX } from '../gfx/textures';
import { T } from '../world/tiles';
import { CONTROLS_TEXT, MenuList } from './ui/MenuList';
import { hiDpi } from './ui/hiDpi';

const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

/** Title screen over a dark, empty office, with drones drifting past. */
export class MenuScene extends Phaser.Scene {
  private help!: Phaser.GameObjects.Container;

  constructor() {
    super('menu');
  }

  create(): void {
    hiDpi(this);
    this.drawOffice();
    this.add.rectangle(VIEW_W / 2, VIEW_H / 2, VIEW_W, VIEW_H, color(PAL.black), 0.55);

    const title = this.add
      .text(VIEW_W / 2, 64, 'GLACIER', { fontFamily: 'monospace', fontSize: '44px', color: PAL.cyan, stroke: PAL.navy, strokeThickness: 6 })
      .setOrigin(0.5);
    this.tweens.add({ targets: title, alpha: 0.75, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.inOut' });
    this.add
      .text(VIEW_W / 2, 100, 'ABANDONED OFFICES', { fontFamily: 'monospace', fontSize: '12px', color: PAL.silver })
      .setOrigin(0.5);
    this.add
      .text(VIEW_W / 2, 130, 'An AI called Glacier took over the network and hunts down every human left.\nGet to the top floor and shut it down.', {
        fontFamily: 'monospace', fontSize: '10px', color: PAL.white, align: 'center', wordWrap: { width: VIEW_W - 60 },
      })
      .setOrigin(0.5, 0);

    new MenuList(this, VIEW_W / 2, 186, [
      { label: 'NEW GAME', action: () => this.newGame() },
      { label: 'HOW TO PLAY', action: () => this.help.setVisible(!this.help.visible) },
    ]);
    this.add
      .text(VIEW_W / 2, VIEW_H - 8, 'W/S choose · Space or Enter confirm', { fontFamily: 'monospace', fontSize: '10px', color: PAL.grey })
      .setOrigin(0.5);

    this.help = this.add
      .container(VIEW_W / 2, 279, [
        this.add.rectangle(0, 0, 300, 104, color(PAL.navy), 0.95).setStrokeStyle(1, color(PAL.cyan)),
        this.add.text(-130, -45, CONTROLS_TEXT, { fontFamily: 'monospace', fontSize: '10px', color: PAL.white, lineSpacing: 3 }),
      ])
      .setVisible(false);

    this.cameras.main.fadeIn(400);
  }

  private newGame(): void {
    this.cameras.main.fadeOut(250, 26, 28, 44);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start('classes'));
  }

  /** A strip of open space for the background: desks, plants and two drones on patrol. */
  private drawOffice(): void {
    const cols = Math.ceil(VIEW_W / TILE);
    const rows = Math.ceil(VIEW_H / TILE);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        const edge = y === 0 || y === rows - 1;
        this.add.image(x * TILE + 8, y * TILE + 8, TEX.tiles, edge ? T.WALL : T.FLOOR);
        if (edge) continue;
        const desk = (y === 4 || y === 16) && x % 6 > 0 && x % 6 < 5;
        if (desk) this.add.image(x * TILE + 8, y * TILE + 8, TEX.tiles, (x * 7 + y) % 3 === 0 ? T.DESK_PC : T.DESK);
        else if ((x * 13 + y * 7) % 47 === 0) this.add.image(x * TILE + 8, y * TILE + 8, TEX.tiles, T.PLANT);
      }
    if (!this.anims.exists('drone-hover')) {
      this.anims.create({ key: 'drone-hover', frames: ['0', '1'].map((frame) => ({ key: TEX.drone, frame })), frameRate: 12, repeat: -1 });
    }
    for (const [y, dir] of [[150, 1], [250, -1]] as const) {
      const drone = this.add.sprite(dir > 0 ? -20 : VIEW_W + 20, y, TEX.drone).play('drone-hover');
      this.tweens.add({ targets: drone, x: dir > 0 ? VIEW_W + 20 : -20, duration: 9000, repeat: -1, delay: dir > 0 ? 0 : 3000 });
    }
  }
}
