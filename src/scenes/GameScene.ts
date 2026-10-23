import Phaser from 'phaser';
import { PLAYER_SPEED, ROOM_H, ROOM_W, TILE, ZOOM } from '../core/config';
import { emit } from '../core/events';
import { ITEMS, grantItem, hasItem, unownedItems, type ItemId } from '../core/items';
import { Controls } from '../core/input';
import { BOSS_NAMES, LEVELS, levelDef, type BossKind } from '../core/levels';
import { deriveSeed, randomSeed } from '../core/rng';
import { newPlayerStats, type PlayerStats } from '../core/stats';
import { Drone, GlacierBoss, GuardBoss, MotherBoss, PrinterBoss, RoguePrinter, type Boss, type Enemy } from '../entities/Enemy';
import { Player } from '../entities/Player';
import { PAL } from '../gfx/pixels';
import { TEX } from '../gfx/textures';
import { Breakables } from '../systems/Breakables';
import { Combat } from '../systems/Combat';
import { Search, type SearchTarget } from '../systems/Search';
import { SecurityCameras } from '../systems/SecurityCameras';
import { Traps } from '../systems/Traps';
import type { CaptchaData } from './CaptchaScene';
import type { InventoryData } from './InventoryScene';
import type { ShopData, ShopOffer } from './ShopScene';
import { DIRS, buildFloorLayers, findRoomAt, generateDungeon, type Dungeon, type EnemyKind, type Room } from '../world/dungeon';
import { rollLoot } from '../world/loot';
import { DOOR_POS, ROOM_CENTER } from '../world/roomLayout';
import { SOLID_TILES, T } from '../world/tiles';

export interface GameSceneData {
  seed?: number;
  /** Level number, from 1 to LEVELS.length. */
  level?: number;
  /** Carried over when taking the elevator; a fresh run when missing. */
  stats?: PlayerStats;
}

const SEARCH_NAMES: Partial<Record<number, string>> = {
  [T.CABINET]: 'cabinet',
  [T.DESK_PC]: 'computer',
  [T.DESK_PC_GLACIER]: 'computer',
  [T.DESK]: 'desk',
};

const BOSS_CLASSES: Record<BossKind, new (scene: Phaser.Scene, x: number, y: number, room: Room) => Boss> = {
  printer: PrinterBoss,
  guard: GuardBoss,
  mother: MotherBoss,
  glacier: GlacierBoss,
};

/** Waves in the secret car park, in order. */
const SECRET_WAVES: EnemyKind[][] = [
  ['drone', 'drone', 'drone'],
  ['drone', 'drone', 'drone', 'printer'],
  ['drone', 'drone', 'drone', 'drone', 'printer', 'printer'],
];

/** What a vending machine slot sells: a consumable or an item. */
type Ware = ShopOffer & { give: (stats: PlayerStats) => string };

const ROOM_PX_W = ROOM_W * TILE;
const ROOM_PX_H = ROOM_H * TILE;
/** Grace period after entering a room before enemies start moving. */
const WAKE_DELAY = 450;

/** Pixel center of a room-local tile. */
function tileCenter(room: Room, tx: number, ty: number): { x: number; y: number } {
  return { x: room.gx * ROOM_PX_W + tx * TILE + TILE / 2, y: room.gy * ROOM_PX_H + ty * TILE + TILE / 2 };
}

export class GameScene extends Phaser.Scene {
  private dungeon!: Dungeon;
  private level = 1;
  private stats!: PlayerStats;
  private player!: Player;
  private controls!: Controls;
  private combat!: Combat;
  private search!: Search;
  private traps!: Traps;
  private securityCameras!: SecurityCameras;
  private base!: Phaser.Tilemaps.TilemapLayer;
  private breakables!: Breakables;
  private currentRoom!: Room;
  private visited = new Set<number>();
  private cleared = new Set<number>();
  private enemiesByRoom = new Map<number, Enemy[]>();
  private boss!: Boss;
  private terminal!: Phaser.GameObjects.Image;
  private terminalUsed = false;
  private elevator!: Phaser.GameObjects.Image;
  private transitioning = false;
  private lastPrompt: string | null = null;
  /** Stock of each vending machine on this level, by room id; filled on first use. */
  private machines = new Map<number, Ware[]>();
  /** Secret car park: 0 before the player walks in, then the number of the current wave. */
  private secretWave = 0;

  constructor() {
    super('game');
  }

  create(data: GameSceneData): void {
    this.level = data.level ?? 1;
    this.stats = data.stats ?? newPlayerStats();
    const seed = data.seed ?? randomSeed();
    this.dungeon = generateDungeon({ seed, level: levelDef(this.level) });
    this.visited = new Set();
    this.cleared = new Set();
    this.enemiesByRoom = new Map();
    this.terminalUsed = false;
    this.transitioning = false;
    this.lastPrompt = null;
    this.machines = new Map();
    this.secretWave = 0;
    this.physics.world.resume();

    const layers = buildFloorLayers(this.dungeon, T.VOID);
    const solid = [layers.base, layers.props].map((data, i) => {
      const map = this.make.tilemap({ data, tileWidth: TILE, tileHeight: TILE });
      const tileset = map.addTilesetImage(TEX.tiles, TEX.tiles, TILE, TILE, 0, 0)!;
      const layer = map.createLayer(0, tileset, 0, 0) as Phaser.Tilemaps.TilemapLayer;
      return layer.setCollision([...SOLID_TILES]).setDepth(-1000 + i);
    });
    [this.base] = solid;

    const start = tileCenter(this.dungeon.start, ROOM_CENTER.x, ROOM_CENTER.y);
    this.player = new Player(this, start.x, start.y);
    this.physics.add.collider(this.player, solid);
    this.controls = new Controls(this);
    this.search = new Search(this, solid[1]);
    this.combat = new Combat(this, this.player, this.stats, this.base, {
      onStatsChanged: () => this.statsChanged(),
      onPlayerHit: (damage) => this.playerHit(damage),
      onEnemyKilled: (enemy) => this.enemyKilled(enemy),
      onOutOfAmmo: () => this.toast('Out of pens. Search the desks.', PAL.orange),
      spawnDrone: (x, y, room) => this.spawnDrone(x, y, room),
      smash: (x, y, radius) => this.breakables.hitCircle(x, y, radius),
    });
    this.breakables = new Breakables(this, [solid[1], this.base], (tile, tx, ty) => {
      if (tile === T.WALL_CRACKED) return this.openSecretPassage(tx, ty);
      const loot = rollLoot(tile, this.dungeon.seed, tx, ty);
      if (!loot) return;
      this.toast(loot.apply(this.stats), PAL.lime);
      this.statsChanged();
    });
    this.traps = new Traps(this, this.player, (from) => {
      if (!hasItem(this.stats, 'wristband') && this.player.hit(from)) this.playerHit(1);
    });
    this.securityCameras = new SecurityCameras(
      this,
      this.player,
      (room) => this.raiseAlarm(room, 'A camera spotted you! Alarm.', 1 + Math.floor((this.level - 1) / 2)),
      () => (hasItem(this.stats, 'hoodie') ? 0.6 : 1),
    );
    this.spawnEnemies();
    this.placeRoomContents();

    const cam = this.cameras.main;
    cam.setZoom(ZOOM);
    cam.setBackgroundColor('#1a1c2c');
    cam.roundPixels = true;

    this.input.keyboard!.on('keydown-R', () => this.restartRun());
    this.input.keyboard!.addCapture('TAB');
    for (const key of ['keydown-I', 'keydown-TAB']) this.input.keyboard!.on(key, () => this.openInventory());

    emit(this.game, 'level:ready', { dungeon: this.dungeon, level: this.level, levelCount: LEVELS.length });
    this.statsChanged();
    this.emitBossHealth(false);
    this.enterRoom(this.dungeon.start, false);
    cam.fadeIn(300);
  }

  update(): void {
    if (this.transitioning) return;
    // The world keeps running while the player is busy searching: cameras
    // sweep, traps cycle and drones fly; only the player stands still.
    this.traps.update(this.currentRoom);
    this.securityCameras.update(this.currentRoom);
    if (this.search.busy) {
      this.player.halt();
      this.combat.update({ melee: false, shoot: false }, this.currentRoom);
      return;
    }

    this.player.move(this.controls.movement());
    this.combat.update({ melee: this.controls.melee, shoot: this.controls.shoot }, this.currentRoom);
    this.updateInteraction();
    if (this.boss.alive && this.currentRoom === this.dungeon.boss) this.emitBossHealth(true);

    const feet = this.player.feet;
    const gx = Math.floor(feet.x / ROOM_PX_W);
    const gy = Math.floor(feet.y / ROOM_PX_H);
    if (gx !== this.currentRoom.gx || gy !== this.currentRoom.gy) {
      const next = findRoomAt(this.dungeon, gx, gy);
      if (next) this.enterRoom(next, true);
    }

    if (!this.boss.alive && Phaser.Math.Distance.Between(feet.x, feet.y, this.elevator.x, this.elevator.y) < 14) {
      this.takeElevator();
    }
  }

  private spawnEnemies(): void {
    for (const room of this.dungeon.rooms) {
      const list = room.enemies.map(({ x, y, kind }) => {
        const p = tileCenter(room, x, y);
        return kind === 'printer' ? new RoguePrinter(this, p.x, p.y, room, this.level) : new Drone(this, p.x, p.y, room, this.level);
      });
      this.enemiesByRoom.set(room.id, list);
      room.traps.forEach(({ x, y }) => this.traps.add(room, x, y));
      if (room.camera) this.securityCameras.add(room, room.camera.x, room.camera.y, room.camera.facing);
    }
    const room = this.dungeon.boss;
    const b = tileCenter(room, ROOM_CENTER.x, ROOM_CENTER.y);
    this.boss = new BOSS_CLASSES[this.dungeon.level.boss](this, b.x, b.y - 4, room);
    this.enemiesByRoom.get(room.id)!.push(this.boss);
    for (const list of this.enemiesByRoom.values()) list.forEach((e) => this.combat.add(e));
  }

  /** Reinforcements (boss summons, alarms): awake at once, and the room's doors shut behind them. */
  private spawnDrone(x: number, y: number, room: Room, kind: EnemyKind = 'drone'): Enemy {
    const drone = kind === 'printer' ? new RoguePrinter(this, x, y, room, this.level) : new Drone(this, x, y, room, this.level);
    this.combat.add(drone);
    this.enemiesByRoom.get(room.id)!.push(drone);
    if (room === this.currentRoom) {
      this.setDoorsLocked(room, true);
      drone.wake();
    }
    return drone;
  }

  /** Allied terminal in the break room, elevator in the wall of the boss room. */
  private placeRoomContents(): void {
    const t = tileCenter(this.dungeon.treasure, ROOM_CENTER.x, ROOM_CENTER.y);
    this.terminal = this.add.image(t.x, t.y, TEX.terminal).setDepth(t.y);
    this.tweens.add({ targets: this.terminal, y: t.y - 2, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });

    // The elevator sits in the wall opposite the boss room's only door (north if that wall is free).
    const boss = this.dungeon.boss;
    const side = boss.doors.n ? 's' : 'n';
    const e = tileCenter(boss, DOOR_POS[side].x, DOOR_POS[side].y);
    this.elevator = this.add.image(e.x, e.y, TEX.elevator).setDepth(-500).setFlipY(side === 's').setAlpha(0.5);
  }

  // ---------------------------------------------------------------- rooms

  private enterRoom(room: Room, animate: boolean): void {
    const previous = this.currentRoom;
    if (previous) this.enemiesByRoom.get(previous.id)?.forEach((e) => e.sleep());
    this.combat.clearShots();
    this.currentRoom = room;
    this.visited.add(room.id);
    emit(this.game, 'room:entered', { room, visited: this.visited });
    this.emitBossHealth(room === this.dungeon.boss && this.boss.alive);

    const cam = this.cameras.main;
    const target = { x: room.gx * ROOM_PX_W + ROOM_PX_W / 2, y: room.gy * ROOM_PX_H + ROOM_PX_H / 2 };
    if (!animate || !previous) {
      cam.centerOn(target.x, target.y);
      this.activateRoom(room);
      return;
    }

    // Zelda-style transition: freeze, slide the camera and nudge the player through the door.
    this.transitioning = true;
    this.player.setVelocity(0, 0);
    this.player.anims.pause();
    this.physics.world.pause();
    const dx = room.gx - previous.gx;
    const dy = room.gy - previous.gy;
    const from = { x: cam.midPoint.x, y: cam.midPoint.y };
    const duration = 350;

    this.tweens.add({
      targets: from,
      x: target.x,
      y: target.y,
      duration,
      ease: 'Sine.inOut',
      onUpdate: () => cam.centerOn(Math.round(from.x), Math.round(from.y)),
    });
    this.tweens.add({
      targets: this.player,
      x: this.player.x + dx * TILE * 1.5,
      y: this.player.y + dy * TILE * 1.5,
      duration,
      onComplete: () => {
        this.player.body.reset(this.player.x, this.player.y);
        this.player.anims.resume();
        this.physics.world.resume();
        this.transitioning = false;
        this.activateRoom(room);
      },
    });
  }

  /** Living enemies wake up after a short delay, and shutters close the doors until they are gone. */
  private activateRoom(room: Room): void {
    this.securityCameras.roomEntered();
    if (room === this.dungeon.secret && this.secretWave === 0) return this.startSecretWaves(room);
    const living = this.livingEnemies(room);
    if (living.length === 0) return;
    this.setDoorsLocked(room, true);
    this.time.delayedCall(WAKE_DELAY, () => {
      if (this.currentRoom === room) living.forEach((e) => e.wake());
    });
  }

  private livingEnemies(room: Room): Enemy[] {
    return (this.enemiesByRoom.get(room.id) ?? []).filter((e) => e.alive);
  }

  private setDoorsLocked(room: Room, locked: boolean): void {
    for (const dir of DIRS) {
      if (!room.doors[dir]) continue;
      const p = DOOR_POS[dir];
      this.base.putTileAt(locked ? T.DOOR_LOCKED : T.DOOR, room.gx * ROOM_W + p.x, room.gy * ROOM_H + p.y);
    }
  }

  // ---------------------------------------------------------------- secret room

  /** The cracked wall gives way: it becomes a door into the hidden car park. */
  private openSecretPassage(tx: number, ty: number): void {
    const host = findRoomAt(this.dungeon, Math.floor(tx / ROOM_W), Math.floor(ty / ROOM_H));
    if (!host?.secretDoor) return;
    host.doors[host.secretDoor] = true;
    const locked = this.livingEnemies(host).length > 0;
    this.base.putTileAt(locked ? T.DOOR_LOCKED : T.DOOR, tx, ty);
    this.cameras.main.shake(150, 0.004);
    this.toast('The wall crumbles. There is a passage behind it!', PAL.yellow);
    emit(this.game, 'room:entered', { room: this.currentRoom, visited: this.visited });
  }

  private startSecretWaves(room: Room): void {
    emit(this.game, 'banner', {
      title: 'UNDERGROUND PARKING',
      line: 'People used to kill each other over these parking spots. Now there is nobody here. Nobody human, anyway.',
      holdMs: 3200,
    });
    this.setDoorsLocked(room, true);
    this.secretWave = 0;
    this.time.delayedCall(2400, () => this.nextSecretWave(room));
  }

  /** Sends the next wave in; returns false once every wave is beaten (and pays out the reward). */
  private nextSecretWave(room: Room): boolean {
    if (this.secretWave >= SECRET_WAVES.length) {
      this.secretReward();
      return false;
    }
    const wave = SECRET_WAVES[this.secretWave++];
    this.toast(`Wave ${this.secretWave}/${SECRET_WAVES.length}`, PAL.red);
    this.time.delayedCall(this.secretWave === 1 ? 0 : 900, () => {
      if (this.currentRoom !== room) return;
      // Drones pour in from the ramps at the sides, printers roll out between the cars.
      const ramps = [{ x: 2, y: 4 }, { x: ROOM_W - 3, y: 4 }, { x: 2, y: 6 }, { x: ROOM_W - 3, y: 6 }];
      const bays = [{ x: 5, y: 4 }, { x: 9, y: 6 }, { x: 9, y: 4 }, { x: 5, y: 6 }];
      wave.forEach((kind, i) => {
        const spot = kind === 'printer' ? bays[i % bays.length] : ramps[i % ramps.length];
        const p = tileCenter(room, spot.x, spot.y);
        this.spawnDrone(p.x + (i % 3) * 4, p.y, room, kind);
      });
    });
    return true;
  }

  private secretReward(): void {
    const [id] = unownedItems(this.stats, this.dungeon.seed + 404);
    const item = id ? ` ${grantItem(this.stats, id)}` : '';
    this.stats.pln += 10;
    this.statsChanged();
    this.toast(`Car park cleared! Someone left 10 PLN in a glovebox.${item}`, PAL.cyan);
  }

  // ---------------------------------------------------------------- combat

  private enemyKilled(enemy: Enemy): void {
    const room = enemy.room;
    this.stats.pln += enemy === this.boss ? 6 : 1;
    this.statsChanged();
    if (enemy === this.boss) {
      // The boss's drones go down with it.
      for (const e of this.livingEnemies(room)) e.hurt(999, new Phaser.Math.Vector2(enemy.x, enemy.y));
      this.emitBossHealth(false);
      if (this.dungeon.level.boss === 'glacier') {
        this.winRun();
        return;
      }
      this.elevator.setAlpha(1);
      // Each mid-level boss leaves an item behind.
      const [drop] = unownedItems(this.stats, this.dungeon.seed + 1);
      const extra = drop ? ` Found: ${grantItem(this.stats, drop)}` : '';
      this.statsChanged();
      this.toast(`${BOSS_NAMES[this.dungeon.level.boss]} offline. The elevator works.${extra}`, PAL.cyan);
    }
    if (this.livingEnemies(room).length > 0) return;
    if (room === this.dungeon.secret && this.nextSecretWave(room)) return;
    this.setDoorsLocked(room, false);
    if (hasItem(this.stats, 'mug') && this.stats.hp < this.stats.maxHp) {
      this.stats.hp++;
      this.statsChanged();
    }
    if (!this.cleared.has(room.id) && enemy !== this.boss && room !== this.dungeon.secret) this.toast('Room clear.');
    this.cleared.add(room.id);
  }

  private playerHit(damage: number): void {
    if (this.transitioning) return;
    this.stats.hp = Math.max(0, this.stats.hp - damage);
    this.statsChanged();
    this.cameras.main.shake(120, 0.004);
    if (this.stats.hp <= 0) {
      emit(this.game, 'player:died', { level: this.level });
      this.restartWith({ seed: randomSeed(), level: 1 }, 1600);
    }
  }

  private statsChanged(): void {
    this.player.speed = PLAYER_SPEED * (hasItem(this.stats, 'espresso') ? 1.2 : 1);
    emit(this.game, 'stats:changed', { stats: this.stats });
  }

  private emitBossHealth(visible: boolean): void {
    emit(this.game, 'boss:health', {
      name: BOSS_NAMES[this.dungeon.level.boss],
      hp: this.boss?.hp ?? 0,
      max: this.boss?.maxHp ?? 1,
      visible,
    });
  }

  // ---------------------------------------------------------------- searching

  private updateInteraction(): void {
    const nearTerminal =
      !this.terminalUsed &&
      this.currentRoom === this.dungeon.treasure &&
      Phaser.Math.Distance.Between(this.player.feet.x, this.player.feet.y, this.terminal.x, this.terminal.y + 6) < 18;
    const vending = nearTerminal ? null : this.search.findTarget(this.player, (t) => t === T.VENDING);
    const target = nearTerminal || vending ? null : this.search.findTarget(this.player);
    // The CCTV computer works even mid-fight: it is how you stop a camera from calling more drones.
    const cctv = target?.tile === T.CAMERA_PC;
    const roomBusy = !cctv && this.livingEnemies(this.currentRoom).length > 0;

    let prompt: string | null = null;
    if (nearTerminal) prompt = '[Space] Connect to the terminal';
    else if (vending) prompt = roomBusy ? 'Deal with the enemies first' : '[Space] Vending machine';
    else if (target && roomBusy) prompt = 'Deal with the enemies first';
    else if (cctv) prompt = '[Space] Shut down the camera';
    else if (target) prompt = `[Space] Search the ${SEARCH_NAMES[target.tile] ?? 'furniture'}`;
    if (prompt !== this.lastPrompt) {
      this.lastPrompt = prompt;
      emit(this.game, 'prompt', { text: prompt });
    }

    if (!this.controls.interact) return;
    if (nearTerminal) this.useTerminal();
    else if (vending && !roomBusy) this.openVending();
    else if (target && !roomBusy) {
      this.player.halt();
      this.search.start(target, (t) => {
        if (t.tile === T.CAMERA_PC) this.shutDownCamera();
        else if (t.tile === T.DESK_PC_GLACIER) this.startCaptcha(t);
        else this.giveLoot(t);
      });
    }
  }

  private shutDownCamera(): void {
    this.securityCameras.disable(this.currentRoom);
    this.toast('Camera offline. It will not call any more drones.', PAL.lime);
  }

  private giveLoot({ tile, tx, ty }: SearchTarget): void {
    const loot = rollLoot(tile, this.dungeon.seed, tx, ty);
    if (!loot) {
      this.toast('Nothing here.', PAL.silver);
      return;
    }
    const text = loot.apply(this.stats);
    this.toast(text, loot.id === 'item' ? PAL.cyan : PAL.lime);
    this.statsChanged();
  }

  /** Glacier's computer asks the player to prove they are a bot. Pass: rich loot. Fail: alarm and drones. */
  private startCaptcha(target: SearchTarget): void {
    const level = this.dungeon.level;
    const room = this.currentRoom;
    const data: CaptchaData = {
      length: level.captchaLength,
      timeMs: level.captchaMs * (hasItem(this.stats, 'headphones') ? 1.6 : 1),
      onDone: (passed) => {
        this.resumeFromOverlay();
        if (passed) this.giveLoot(target);
        else this.raiseAlarm(room, 'ALARM! Glacier detected a human.', 1 + Math.ceil(this.level / 2));
      },
    };
    this.player.halt();
    this.scene.pause();
    this.scene.launch('captcha', data);
  }

  /** Glacier sends drones into the room; they fly in through its doors, which then shut. */
  private raiseAlarm(room: Room, message: string, count: number): void {
    this.toast(message, PAL.red);
    this.cameras.main.flash(200, 177, 62, 83);
    // Drones fly in through the room's doors.
    const doors = DIRS.filter((d) => room.doors[d]).map((d) => DOOR_POS[d]);
    for (let i = 0; i < count; i++) {
      const d = doors[i % doors.length];
      const inward = { x: Phaser.Math.Clamp(d.x, 2, ROOM_W - 3), y: Phaser.Math.Clamp(d.y, 2, ROOM_H - 3) };
      const p = tileCenter(room, inward.x, inward.y);
      this.spawnDrone(p.x + (i % 2) * 6, p.y, room);
    }
  }

  /** Coming back from the minigame or the shop: drop keys pressed meanwhile so nothing fires twice. */
  private resumeFromOverlay(): void {
    this.input.keyboard!.resetKeys();
    this.scene.resume();
  }

  /** Each machine sells one consumable and two items the player does not own yet. */
  private machineStock(room: Room): Ware[] {
    const existing = this.machines.get(room.id);
    if (existing) return existing;
    const seed = this.dungeon.seed + room.id * 7919;
    const consumable: Ware =
      seed % 2 === 0
        ? {
            name: 'Protein bar', desc: '+2 HP', price: 3, sold: false,
            give: (s) => {
              s.hp = Math.min(s.maxHp, s.hp + 2);
              return 'Protein bar: +2 HP';
            },
          }
        : {
            name: 'Pack of pens', desc: '+6 pens', price: 3, sold: false,
            give: (s) => {
              s.pens = Math.min(s.maxPens, s.pens + 6);
              return 'Pack of pens: +6';
            },
          };
    const items: Ware[] = unownedItems(this.stats, seed)
      .slice(0, 2)
      .map((id: ItemId) => ({ ...ITEMS[id], sold: false, give: (s: PlayerStats) => grantItem(s, id) }));
    const stock = [consumable, ...items];
    this.machines.set(room.id, stock);
    return stock;
  }

  private openVending(): void {
    const stock = this.machineStock(this.currentRoom);
    const data: ShopData = {
      offers: stock,
      stats: this.stats,
      onBuy: (i) => {
        const ware = stock[i];
        if (ware.sold) return 'Sold out.';
        if (this.stats.pln < ware.price) return `Not enough cash (you need ${ware.price} PLN).`;
        this.stats.pln -= ware.price;
        ware.sold = true;
        const text = ware.give(this.stats);
        this.statsChanged();
        return `Bought. ${text}`;
      },
      onClose: () => this.resumeFromOverlay(),
    };
    this.player.halt();
    this.scene.pause();
    this.scene.launch('shop', data);
  }

  private openInventory(): void {
    if (this.transitioning || this.search.busy) return;
    const data: InventoryData = { stats: this.stats, onClose: () => this.resumeFromOverlay() };
    this.player.halt();
    this.scene.pause();
    this.scene.launch('inventory', data);
  }

  /** The allied software restores the player and shares one item. */
  private useTerminal(): void {
    this.terminalUsed = true;
    const [id] = unownedItems(this.stats, this.dungeon.seed + this.level);
    const text = id ? grantItem(this.stats, id) : '';
    this.stats.hp = this.stats.maxHp;
    this.stats.pens = Math.max(this.stats.pens, 10);
    this.statsChanged();
    this.toast(`Allied software ARGUS: full repair. ${text}`, PAL.lime);
    this.tweens.killTweensOf(this.terminal);
    this.terminal.setAlpha(0.6);
  }

  private toast(text: string, color?: string): void {
    emit(this.game, 'toast', { text, color });
  }

  // ---------------------------------------------------------------- levels

  private takeElevator(): void {
    this.restartWith({ seed: deriveSeed(this.dungeon.seed, this.level), level: this.level + 1, stats: this.stats });
  }

  private winRun(): void {
    this.elevator.setAlpha(1);
    emit(this.game, 'game:won', { stats: this.stats });
    this.restartWith({ seed: randomSeed(), level: 1 }, 6000);
  }

  private restartRun(): void {
    this.restartWith({ seed: randomSeed(), level: 1 });
  }

  private restartWith(data: GameSceneData, delay = 0): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.halt();
    this.physics.world.pause();
    this.time.delayedCall(delay, () => {
      this.cameras.main.fadeOut(300, 26, 28, 44);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart(data));
    });
  }
}
