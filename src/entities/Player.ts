import Phaser from 'phaser';
import { PLAYER_SPEED } from '../core/config';
import type { HeroFacing } from '../gfx/sprites';

export interface MoveInput {
  x: number;
  y: number;
}

const INVULNERABLE_MS = 1000;
const KNOCKBACK_MS = 150;

/** Player character. Reads a movement vector, handles velocity, aim, animation and getting hit. */
export class Player extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  private facing: HeroFacing = 'down';
  /** Unit vector of the last movement direction; attacks go this way. */
  readonly aim = new Phaser.Math.Vector2(0, 1);
  speed = PLAYER_SPEED;
  private invulnerableUntil = 0;
  private knockbackUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, private readonly sheet: string) {
    super(scene, x, y, sheet, 'down-0');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    // Collide with the feet only, so the head can overlap walls (classic top-down look).
    this.body.setSize(10, 6).setOffset(3, 10);
    Player.createAnims(scene, sheet);
  }

  /** Point where the player stands; used for room detection and depth sorting. */
  get feet(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.body.center.x, this.body.center.y);
  }

  /** Middle of the sprite; attacks start here. */
  get chest(): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(this.x, this.y + 2);
  }

  get invulnerable(): boolean {
    return this.scene.time.now < this.invulnerableUntil;
  }

  move(input: MoveInput): void {
    this.setDepth(this.y);
    this.setAlpha(this.invulnerable && Math.floor(this.scene.time.now / 80) % 2 === 0 ? 0.3 : 1);
    if (this.scene.time.now < this.knockbackUntil) return;

    const v = new Phaser.Math.Vector2(input.x, input.y);
    if (v.lengthSq() > 0) {
      v.normalize();
      this.aim.copy(v);
      v.scale(this.speed);
    }
    this.setVelocity(v.x, v.y);

    if (v.lengthSq() === 0) {
      this.anims.stop();
      this.setFrame(`${this.facing}-0`);
    } else {
      if (Math.abs(input.x) > Math.abs(input.y)) this.facing = 'side';
      else this.facing = input.y < 0 ? 'up' : 'down';
      if (input.x !== 0) this.setFlipX(input.x < 0);
      this.anims.play(`${this.sheet}-walk-${this.facing}`, true);
    }
  }

  halt(): void {
    this.setVelocity(0, 0);
    this.anims.stop();
    this.setFrame(`${this.facing}-0`);
  }

  /** Returns false if the hit was ignored because of invulnerability frames. */
  hit(from: Phaser.Math.Vector2): boolean {
    if (this.invulnerable) return false;
    const now = this.scene.time.now;
    this.invulnerableUntil = now + INVULNERABLE_MS;
    this.knockbackUntil = now + KNOCKBACK_MS;
    const push = this.feet.subtract(from).normalize().scale(160);
    this.setVelocity(push.x, push.y);
    return true;
  }

  /** Walk cycles for a hero sheet; also used by the class picker. */
  static createAnims(scene: Phaser.Scene, sheet: string): void {
    for (const facing of ['down', 'up', 'side'] as const) {
      const key = `${sheet}-walk-${facing}`;
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: [1, 0, 2, 0].map((i) => ({ key: sheet, frame: `${facing}-${i}` })),
        frameRate: 8,
        repeat: -1,
      });
    }
  }
}
