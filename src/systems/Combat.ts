import Phaser from 'phaser';
import { hasItem } from '../core/items';
import type { PlayerStats } from '../core/stats';
import { Boss, Enemy, type EnemyWorld, type ShotKind } from '../entities/Enemy';
import type { Player } from '../entities/Player';
import { TEX } from '../gfx/textures';
import type { Room } from '../world/dungeon';

const MELEE_COOLDOWN = 380;
const MELEE_REACH = 13;
const MELEE_RADIUS = 13;
const BADGE_DISTANCE = 13;
const SHOT_COOLDOWN = 280;
const SHOT_SPEED = 220;
const SHOT_LIFETIME = 1200;

export interface CombatHooks {
  onStatsChanged(): void;
  onPlayerHit(damage: number): void;
  onEnemyKilled(enemy: Enemy): void;
  onOutOfAmmo(): void;
  spawnDrone(x: number, y: number, room: Room): Enemy;
  /** Smashes breakable clutter touching the circle; true when something was hit. */
  smash(x: number, y: number, radius: number): boolean;
}

/**
 * Player attacks, enemy AI ticking, projectiles and every damage collision.
 * GameScene owns the rules around it (doors, death, loot); this class only resolves hits.
 */
export class Combat implements EnemyWorld {
  readonly enemies: Phaser.Physics.Arcade.Group;
  private readonly playerShots: Phaser.Physics.Arcade.Group;
  private readonly enemyShots: Phaser.Physics.Arcade.Group;
  private nextMelee = 0;
  private nextShot = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly player: Player,
    private readonly stats: PlayerStats,
    /** Drones and projectiles fly over furniture, so only walls and shutters stop them. */
    walls: Phaser.Tilemaps.TilemapLayer,
    private readonly hooks: CombatHooks,
  ) {
    const physics = scene.physics;
    this.enemies = physics.add.group();
    this.playerShots = physics.add.group();
    this.enemyShots = physics.add.group();

    physics.add.collider(this.enemies, walls);
    physics.add.collider(this.enemies, this.enemies);
    physics.add.collider(this.enemyShots, walls, (shot) => this.pop(shot as Phaser.Physics.Arcade.Image));
    physics.add.collider(this.playerShots, walls, (shot) => {
      // A pen that hits a cracked wall chips at it.
      const s = shot as Phaser.Physics.Arcade.Image;
      // Velocity is already zeroed by the collision, but the pen still points where it flew.
      this.hooks.smash(s.x + Math.cos(s.rotation) * 6, s.y + Math.sin(s.rotation) * 6, 2);
      this.pop(s);
    });

    physics.add.overlap(this.playerShots, this.enemies, (shot, enemy) => {
      const s = shot as Phaser.Physics.Arcade.Image;
      const e = enemy as Enemy;
      if (!e.alive || !s.active) return;
      // Gel pens fly through enemies, hitting each one once.
      if (hasItem(this.stats, 'gelPen')) {
        const hit: Set<Enemy> = s.getData('hit') ?? new Set();
        if (hit.has(e)) return;
        s.setData('hit', hit.add(e));
      } else {
        this.pop(s);
      }
      if (e instanceof Boss && e.deflectsShot()) return;
      this.damageEnemy(e, this.stats.rangedDamage, new Phaser.Math.Vector2(s.x, s.y), 80);
    });
    physics.add.overlap(player, this.enemyShots, (_p, shot) => {
      const s = shot as Phaser.Physics.Arcade.Image;
      if (!s.active || !this.player.hit(new Phaser.Math.Vector2(s.x, s.y))) return;
      this.pop(s);
      this.hooks.onPlayerHit(1);
    });
    physics.add.overlap(player, this.enemies, (_p, enemy) => {
      const e = enemy as Enemy;
      if (e.alive && this.player.hit(new Phaser.Math.Vector2(e.x, e.y))) this.hooks.onPlayerHit(e.contactDamage);
    });
  }

  add(enemy: Enemy): void {
    this.enemies.add(enemy);
    // Adding to a physics group re-enables the body, so put it back to sleep until its room is entered.
    enemy.sleep();
  }

  /** Only enemies of the room the player is in may act; the rest stay asleep. */
  update(input: { melee: boolean; shoot: boolean }, activeRoom: Room): void {
    if (input.melee) this.melee();
    else if (input.shoot) this.shoot();
    // Pens fly over desks, but boxes, chairs and flowers stop them (and take the hit).
    for (const shot of this.playerShots.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (shot.active && this.hooks.smash(shot.x, shot.y, 2)) this.pop(shot);
    }
    for (const e of this.enemies.getChildren() as Enemy[]) {
      if (e.room === activeRoom) e.update(this);
      else if (e.body.enable) e.sleep();
    }
  }

  /** Swing the badge on its lanyard across the aim direction; hits every enemy inside the arc's circle. */
  private melee(): void {
    const now = this.scene.time.now;
    if (now < this.nextMelee) return;
    this.nextMelee = now + MELEE_COOLDOWN;

    const long = hasItem(this.stats, 'bungee') ? 1.5 : 1;
    const origin = this.player.chest;
    const hitPoint = origin.clone().add(this.player.aim.clone().scale(MELEE_REACH * long));
    const radius = MELEE_RADIUS * long;
    this.swingBadge(BADGE_DISTANCE * long);

    if (hasItem(this.stats, 'vipBadge')) {
      for (const shot of this.enemyShots.getChildren() as Phaser.Physics.Arcade.Image[]) {
        if (Phaser.Math.Distance.Between(hitPoint.x, hitPoint.y, shot.x, shot.y) <= radius + 4) this.pop(shot);
      }
    }

    for (const e of this.enemies.getChildren() as Enemy[]) {
      if (!e.alive || !e.body.enable) continue;
      const reach = radius + e.body.halfWidth;
      if (Phaser.Math.Distance.Between(hitPoint.x, hitPoint.y, e.body.center.x, e.body.center.y) <= reach) {
        this.damageEnemy(e, this.stats.meleeDamage, origin, 160);
      }
    }
    this.hooks.smash(hitPoint.x, hitPoint.y, radius);
  }

  /** Purely visual: the badge sweeps a 120° arc around the player, the lanyard drawn as a line. */
  private swingBadge(distance: number): void {
    const badge = this.scene.add.image(0, 0, TEX.fx, 'badge');
    const cord = this.scene.add.graphics();
    const base = this.player.aim.angle();
    const swing = { t: -1 };
    const draw = () => {
      const from = this.player.chest;
      const angle = base + swing.t * 1.05;
      const x = from.x + Math.cos(angle) * distance;
      const y = from.y + Math.sin(angle) * distance;
      badge.setPosition(x, y).setRotation(angle - Math.PI / 2).setDepth(this.player.depth + 1);
      cord.clear().lineStyle(1, 0xb13e53).lineBetween(from.x, from.y - 3, x, y).setDepth(this.player.depth + 0.5);
    };
    draw();
    this.scene.tweens.add({
      targets: swing,
      t: 1,
      duration: 150,
      ease: 'Quad.out',
      onUpdate: draw,
      onComplete: () => {
        badge.destroy();
        cord.destroy();
      },
    });
  }

  /** Throws a pen in the aim direction, using one from the stash. */
  private shoot(): void {
    const now = this.scene.time.now;
    if (now < this.nextShot) return;
    this.nextShot = now + SHOT_COOLDOWN * (hasItem(this.stats, 'stapler') ? 0.5 : 1);
    if (this.stats.pens <= 0) {
      this.hooks.onOutOfAmmo();
      return;
    }
    if (!(hasItem(this.stats, 'penPocket') && Math.random() < 1 / 3)) this.stats.pens--;
    this.hooks.onStatsChanged();

    const origin = this.player.chest.add(this.player.aim.clone().scale(6));
    const base = this.player.aim.angle();
    const spread = hasItem(this.stats, 'fourColorPen') ? [-0.22, 0, 0.22] : [0];
    for (const offset of spread) {
      const angle = base + offset;
      const shot = this.playerShots.create(origin.x, origin.y, TEX.fx, 'pen') as Phaser.Physics.Arcade.Image;
      shot.body!.setCircle(3, 5, 5);
      shot.setRotation(angle).setVelocity(Math.cos(angle) * SHOT_SPEED, Math.sin(angle) * SHOT_SPEED).setDepth(10000);
      this.scene.time.delayedCall(SHOT_LIFETIME, () => this.pop(shot));
    }
  }

  /** Spawns one of Glacier's ice shards. Arrow function so enemies can pass it around. */
  fireEnemyShot = (x: number, y: number, angle: number, speed: number, kind: ShotKind = 'ice'): void => {
    const shot = this.enemyShots.create(x, y, TEX.fx, kind) as Phaser.Physics.Arcade.Image;
    shot.body!.setCircle(3, 5, 5);
    shot.setRotation(angle).setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed).setDepth(10000);
    this.scene.time.delayedCall(4000, () => this.pop(shot));
  };

  spawnDrone = (x: number, y: number, room: Room): Enemy => this.hooks.spawnDrone(x, y, room);

  private damageEnemy(e: Enemy, damage: number, from: Phaser.Math.Vector2, knockback: number): void {
    if (e.hurt(damage, from, knockback)) this.hooks.onEnemyKilled(e);
  }

  private pop(shot: Phaser.Physics.Arcade.Image): void {
    if (shot.active) shot.destroy();
  }

  clearShots(): void {
    this.playerShots.clear(true, true);
    this.enemyShots.clear(true, true);
  }
}
