import Phaser from 'phaser';
import { TEX } from '../gfx/textures';
import type { Room } from '../world/dungeon';
import type { Player } from './Player';

export type ShotKind = 'ice' | 'paper';

/** What enemies may ask of the game: the player, projectiles and reinforcements. */
export interface EnemyWorld {
  player: Player;
  fireEnemyShot(x: number, y: number, angle: number, speed: number, kind?: ShotKind): void;
  /** Spawns an awake drone in the enemy's room; returns it so bosses can track their swarm. */
  spawnDrone(x: number, y: number, room: Room): Enemy;
}

/** Base class for everything Glacier sends at the player. Starts asleep until its room is entered. */
export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  hp: number;
  readonly maxHp: number;
  readonly contactDamage: number = 1;
  protected stunnedUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, readonly room: Room, hp: number) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.hp = this.maxHp = hp;
    this.sleep();
  }

  get alive(): boolean {
    return this.hp > 0;
  }

  sleep(): void {
    this.body.enable = false;
    this.setVelocity(0, 0);
  }

  wake(): void {
    if (this.alive) this.body.enable = true;
  }

  /** Applies damage and knockback. Returns true if this hit destroyed the enemy. */
  hurt(damage: number, from: Phaser.Math.Vector2, knockback = 120): boolean {
    if (!this.alive) return false;
    this.hp -= damage;
    this.stunnedUntil = this.scene.time.now + 180;
    const push = new Phaser.Math.Vector2(this.x - from.x, this.y - from.y).normalize().scale(knockback);
    this.setVelocity(push.x, push.y);
    this.scene.tweens.add({ targets: this, alpha: 0.2, yoyo: true, duration: 50, repeat: 1 });
    if (this.hp <= 0) {
      this.die();
      return true;
    }
    return false;
  }

  protected die(): void {
    this.body.enable = false;
    this.scene.tweens.killTweensOf(this);
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      scale: this.scale * 1.6,
      angle: 90,
      duration: 250,
      onComplete: () => this.setVisible(false),
    });
  }

  update(world: EnemyWorld): void {
    if (!this.alive || !this.body.enable) return;
    this.setDepth(this.y);
    if (this.scene.time.now < this.stunnedUntil) return;
    this.think(world);
  }

  protected abstract think(world: EnemyWorld): void;
}

/** Frost drone: flies straight at the player. */
export class Drone extends Enemy {
  private readonly speed: number;

  constructor(scene: Phaser.Scene, x: number, y: number, room: Room, level: number) {
    super(scene, x, y, TEX.drone, room, 3 + Math.floor((level - 1) / 2));
    this.speed = 36 + level * 4;
    this.body.setCircle(6, 2, 2);
    if (!scene.anims.exists('drone-hover')) {
      scene.anims.create({ key: 'drone-hover', frames: ['0', '1'].map((frame) => ({ key: TEX.drone, frame })), frameRate: 12, repeat: -1 });
    }
    this.play('drone-hover');
  }

  protected think({ player }: EnemyWorld): void {
    const dir = new Phaser.Math.Vector2(player.feet.x - this.x, player.feet.y - this.y).normalize();
    this.setVelocity(dir.x * this.speed, dir.y * this.speed);
  }
}

/**
 * Rogue vacuum robot: rolls on the floor (furniture blocks it, unlike drones). It sits still,
 * flashes red, then charges at where the player was, bouncing off whatever it hits, then rests again.
 */
export class Roomba extends Enemy {
  static readonly WINDUP_MS = 550;
  static readonly REST_MS = 700;
  static readonly CHARGE_MS = 1000;
  private mode: 'rest' | 'windup' | 'charge' = 'rest';
  private stateUntil = 0;
  private readonly speed: number;

  constructor(scene: Phaser.Scene, x: number, y: number, room: Room, level: number) {
    super(scene, x, y, TEX.roomba, room, 4 + Math.floor((level - 1) / 2));
    this.speed = 135 + level * 10;
    this.body.setCircle(6, 2, 3);
  }

  wake(): void {
    super.wake();
    // Set here, not in the constructor: joining the physics group resets the bounce.
    this.body.setBounce(1, 1);
    this.rest(400 + Math.random() * 500);
  }

  private rest(ms: number): void {
    this.mode = 'rest';
    this.stateUntil = this.scene.time.now + ms;
    this.setVelocity(0, 0);
    this.setFrame('0');
  }

  protected think({ player }: EnemyWorld): void {
    const now = this.scene.time.now;
    if (this.mode === 'rest') {
      this.setVelocity(0, 0);
      if (now < this.stateUntil) return;
      this.mode = 'windup';
      this.stateUntil = now + Roomba.WINDUP_MS;
      this.setFrame('1');
      this.scene.tweens.add({ targets: this, scale: 1.12, yoyo: true, duration: 90, repeat: 2 });
    } else if (this.mode === 'windup') {
      this.setVelocity(0, 0);
      if (now < this.stateUntil) return;
      const dir = new Phaser.Math.Vector2(player.feet.x - this.x, player.feet.y - this.y).normalize();
      this.mode = 'charge';
      this.stateUntil = now + Roomba.CHARGE_MS;
      this.setVelocity(dir.x * this.speed, dir.y * this.speed);
      this.setRotation(dir.angle() + Math.PI / 2);
    } else {
      // It bounces off walls and furniture (body bounce 1) and keeps going until the charge runs out.
      const v = this.body.velocity;
      this.setRotation(v.angle() + Math.PI / 2);
      if (now >= this.stateUntil || v.length() < this.speed * 0.2) this.rest(Roomba.REST_MS);
    }
  }
}

/** Rogue office printer: bolted to the floor, spits a sheet of paper at the player every two seconds. */
export class RoguePrinter extends Enemy {
  static readonly FIRE_MS = 2000;
  private nextShot = 0;
  private readonly shotSpeed: number;

  constructor(scene: Phaser.Scene, x: number, y: number, room: Room, level: number) {
    super(scene, x, y, TEX.bosses, room, 4 + Math.floor((level - 1) / 2));
    this.setFrame('rogue-printer');
    this.shotSpeed = 80 + level * 8;
    this.body.setSize(12, 10).setOffset(2, 4);
    this.body.pushable = false;
  }

  wake(): void {
    super.wake();
    // Staggered so a room full of printers does not fire in one volley.
    this.nextShot = this.scene.time.now + 900 + Math.random() * 900;
  }

  /** Too heavy to be knocked back. */
  hurt(damage: number, from: Phaser.Math.Vector2): boolean {
    const dead = super.hurt(damage, from, 0);
    this.setVelocity(0, 0);
    return dead;
  }

  protected think({ player, fireEnemyShot }: EnemyWorld): void {
    this.setVelocity(0, 0);
    const now = this.scene.time.now;
    if (now < this.nextShot) return;
    this.nextShot = now + RoguePrinter.FIRE_MS;
    const aim = Phaser.Math.Angle.Between(this.x, this.y, player.feet.x, player.feet.y);
    fireEnemyShot(this.x, this.y + 2, aim, this.shotSpeed, 'paper');
    // A little shudder sells the "printing" moment.
    this.scene.tweens.add({ targets: this, scaleY: 0.85, yoyo: true, duration: 80 });
  }
}

/** A boss counts at most one pen per this many ms, so a fan of pens does not melt it. */
const BOSS_SHOT_IFRAMES = 220;

/** Shared bits of every boss: a name for the health bar, scaled-up body, not pushable. */
export abstract class Boss extends Enemy {
  readonly contactDamage: number = 2;
  protected nextAttack = 0;
  protected pattern = 0;
  private shotImmuneUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string, frame: string | undefined, room: Room, hp: number) {
    super(scene, x, y, texture, room, hp);
    if (frame) this.setFrame(frame);
    this.setScale(2);
    this.body.setCircle(6, 2, 2);
    this.body.pushable = false;
  }

  get enraged(): boolean {
    return this.hp < this.maxHp / 2;
  }

  wake(): void {
    super.wake();
    this.nextAttack = this.scene.time.now + 1200;
  }

  /** True when a pen should bounce off: the boss was hit by another pen a moment ago. */
  deflectsShot(): boolean {
    const now = this.scene.time.now;
    if (now < this.shotImmuneUntil) return true;
    this.shotImmuneUntil = now + BOSS_SHOT_IFRAMES;
    return false;
  }

  /** Bosses barely flinch. */
  hurt(damage: number, from: Phaser.Math.Vector2, knockback = 120): boolean {
    return super.hurt(damage, from, knockback * 0.15);
  }

  protected angleTo(player: Player): number {
    return Phaser.Math.Angle.Between(this.x, this.y, player.feet.x, player.feet.y);
  }
}

/** Level 1: network printer. Slides along the room and sprays paper. */
export class PrinterBoss extends Boss {
  private dir = 1;

  constructor(scene: Phaser.Scene, x: number, y: number, room: Room) {
    super(scene, x, y, TEX.bosses, 'printer', room, 45);
  }

  protected think({ player, fireEnemyShot }: EnemyWorld): void {
    const now = this.scene.time.now;
    if (this.body.blocked.left) this.dir = 1;
    if (this.body.blocked.right) this.dir = -1;
    this.setVelocity(this.dir * (this.enraged ? 45 : 30), 0);

    if (now < this.nextAttack) return;
    const aim = this.angleTo(player);
    if (this.pattern % 2 === 0) {
      for (const spread of [-0.4, -0.2, 0, 0.2, 0.4]) fireEnemyShot(this.x, this.y, aim + spread, 95, 'paper');
    } else {
      const count = this.enraged ? 14 : 10;
      for (let i = 0; i < count; i++) fireEnemyShot(this.x, this.y, (i / count) * Math.PI * 2, 60, 'paper');
    }
    this.pattern++;
    this.nextAttack = now + (this.enraged ? 1100 : 1600);
  }
}

/** Level 2: security robot. Winds up, then charges in a straight line until it hits a wall. */
export class GuardBoss extends Boss {
  private phase: 'walk' | 'windup' | 'dash' | 'recover' = 'walk';
  private stateUntil = 0;
  private dashDir = new Phaser.Math.Vector2();

  constructor(scene: Phaser.Scene, x: number, y: number, room: Room) {
    super(scene, x, y, TEX.bosses, 'guard', room, 60);
  }

  wake(): void {
    super.wake();
    this.enter('walk', 1200);
  }

  private enter(phase: GuardBoss['phase'], ms: number): void {
    this.phase = phase;
    this.stateUntil = this.scene.time.now + ms;
  }

  protected think({ player }: EnemyWorld): void {
    const now = this.scene.time.now;
    switch (this.phase) {
      case 'walk': {
        const a = this.angleTo(player);
        this.setVelocity(Math.cos(a) * 25, Math.sin(a) * 25);
        if (now > this.stateUntil) this.enter('windup', this.enraged ? 400 : 650);
        break;
      }
      case 'windup':
        // Shaking in place tells the player a charge is coming.
        this.setVelocity(0, 0);
        this.x += Math.sin(now / 20);
        if (now > this.stateUntil) {
          this.dashDir.setToPolar(this.angleTo(player), 1);
          this.enter('dash', 900);
        }
        break;
      case 'dash': {
        const speed = this.enraged ? 240 : 200;
        this.setVelocity(this.dashDir.x * speed, this.dashDir.y * speed);
        const b = this.body.blocked;
        if (now > this.stateUntil || b.left || b.right || b.up || b.down) {
          this.scene.cameras.main.shake(100, 0.003);
          this.enter('recover', this.enraged ? 600 : 900);
        }
        break;
      }
      case 'recover':
        this.setVelocity(0, 0);
        if (now > this.stateUntil) this.enter('walk', 900);
        break;
    }
  }
}

/** Level 3: drone carrier. Keeps its distance, launches drones and fires rings. */
export class MotherBoss extends Boss {
  private brood: Enemy[] = [];
  private nextSpawn = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, room: Room) {
    super(scene, x, y, TEX.bosses, 'mother', room, 70);
  }

  wake(): void {
    super.wake();
    this.nextSpawn = this.scene.time.now + 800;
  }

  protected think({ player, fireEnemyShot, spawnDrone }: EnemyWorld): void {
    const now = this.scene.time.now;
    const a = this.angleTo(player);
    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.feet.x, player.feet.y);
    const away = dist < 70 ? -1 : dist > 100 ? 1 : 0;
    this.setVelocity(Math.cos(a) * 22 * away, Math.sin(a) * 22 * away);

    this.brood = this.brood.filter((d) => d.alive);
    if (now > this.nextSpawn && this.brood.length < (this.enraged ? 5 : 3)) {
      this.brood.push(spawnDrone(this.x - 10, this.y + 12, this.room), spawnDrone(this.x + 10, this.y + 12, this.room));
      this.nextSpawn = now + 4000;
    }
    if (now > this.nextAttack) {
      const count = this.enraged ? 10 : 7;
      for (let i = 0; i < count; i++) fireEnemyShot(this.x, this.y, this.pattern * 0.4 + (i / count) * Math.PI * 2, 65);
      this.pattern++;
      this.nextAttack = now + 2200;
    }
  }
}

/** Final boss: Glacier. Drifts towards the player, alternates shard patterns, calls drones when cornered. */
export class GlacierBoss extends Boss {
  private nextSummon = 0;
  private brood: Enemy[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number, room: Room) {
    super(scene, x, y, TEX.glacier, undefined, room, 110);
  }

  protected think({ player, fireEnemyShot, spawnDrone }: EnemyWorld): void {
    const now = this.scene.time.now;
    const toPlayer = this.angleTo(player);
    this.setVelocity(Math.cos(toPlayer) * 14, Math.sin(toPlayer) * 14);
    this.setAlpha(0.8 + Math.sin(now / 150) * 0.2);

    // Last third of its health: Glacier calls in drones.
    this.brood = this.brood.filter((d) => d.alive);
    if (this.hp < this.maxHp / 3 && now > this.nextSummon && this.brood.length < 3) {
      this.brood.push(spawnDrone(this.x, this.y + 16, this.room));
      this.nextSummon = now + 6000;
    }

    if (now < this.nextAttack) return;
    if (this.pattern % 2 === 0) {
      const count = this.enraged ? 12 : 8;
      const offset = this.pattern * 0.3;
      for (let i = 0; i < count; i++) fireEnemyShot(this.x, this.y, offset + (i / count) * Math.PI * 2, 85);
    } else {
      for (const spread of this.enraged ? [-0.3, -0.15, 0, 0.15, 0.3] : [-0.2, 0, 0.2]) fireEnemyShot(this.x, this.y, toPlayer + spread, 115);
    }
    this.pattern++;
    this.nextAttack = now + (this.enraged ? 1300 : 2000);
  }
}
