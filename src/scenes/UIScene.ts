import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../core/config';
import { off, on, type GameEventName, type GameEvents } from '../core/events';
import { PAL } from '../gfx/pixels';
import { TEX } from '../gfx/textures';
import { DIRS, DIR_VEC, findRoomAt, type Dungeon, type Room } from '../world/dungeon';

const CELL_W = 12;
const CELL_H = 9;
const GAP = 2;
const PAD = 8;
/** How many rooms around the current one the minimap shows. */
const RADIUS_X = 3;
const RADIUS_Y = 2;

const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;
const textStyle = (size: number, fill: string = PAL.white): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: 'monospace',
  fontSize: `${size}px`,
  color: fill,
  stroke: PAL.black,
  strokeThickness: 3,
});

/** HUD overlay on top of the game scene: health, batteries, pln, minimap, messages, boss bar. */
export class UIScene extends Phaser.Scene {
  private dungeon?: Dungeon;
  private map!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Text;
  private itemList!: Phaser.GameObjects.Text;
  private boostText!: Phaser.GameObjects.Text;
  private hearts: Phaser.GameObjects.Image[] = [];
  private pens!: Phaser.GameObjects.Text;
  private pln!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Container;
  private toastText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private bossBar!: Phaser.GameObjects.Graphics;
  private bossLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('ui');
  }

  create(): void {
    // The scene is reused for every run; the old heart images were destroyed with the last one.
    this.hearts = [];
    this.map = this.add.graphics();

    // Top left: hearts, then batteries and pln.
    this.add.image(PAD + 8, PAD + 34, TEX.icons, 'pen');
    this.pens = this.add.text(PAD + 18, PAD + 27, '', textStyle(12));
    this.add.image(PAD + 70, PAD + 34, TEX.icons, 'coin');
    this.pln = this.add.text(PAD + 82, PAD + 27, '', textStyle(12));
    this.info = this.add.text(PAD, PAD + 46, '', textStyle(10, PAL.silver));
    // Items live in the inventory screen (I), so the HUD only counts them and never covers the room.
    this.itemList = this.add.text(PAD, PAD + 60, '', textStyle(10, PAL.cyan));
    this.boostText = this.add.text(PAD, PAD + 74, '', textStyle(10, PAL.yellow));

    this.add
      .text(PAD, VIEW_H - PAD, 'WSAD move · J badge · K pen · Space search · I inventory · Esc pause', textStyle(10, PAL.silver))
      .setOrigin(0, 1);

    this.promptText = this.add.text(VIEW_W / 2, VIEW_H - 46, '', textStyle(12, PAL.yellow)).setOrigin(0.5);
    this.toastText = this.add
      .text(VIEW_W / 2, VIEW_H - 58, '', { ...textStyle(12), align: 'center', wordWrap: { width: VIEW_W - 40 } })
      .setOrigin(0.5, 1)
      .setAlpha(0);

    this.bossBar = this.add.graphics();
    this.bossLabel = this.add.text(VIEW_W / 2, PAD, 'GLACIER', textStyle(11, PAL.cyan)).setOrigin(0.5, 0).setVisible(false);

    const title = this.add.text(0, -10, '', { ...textStyle(22, PAL.cyan), strokeThickness: 4 }).setOrigin(0.5);
    const line = this.add
      .text(0, 16, '', { ...textStyle(12), align: 'center', wordWrap: { width: VIEW_W - 80 } })
      .setOrigin(0.5, 0);
    this.banner = this.add.container(VIEW_W / 2, VIEW_H / 2 - 40, [title, line]).setAlpha(0);

    this.listen('level:ready', this.onLevelReady);
    this.listen('room:entered', this.onRoomEntered);
    this.listen('stats:changed', this.onStats);
    this.listen('toast', this.onToast);
    this.listen('prompt', ({ text }) => this.promptText.setText(text ?? ''));
    this.listen('boss:health', this.onBossHealth);
    this.listen('boost', ({ secondsLeft }) => this.boostText.setText(secondsLeft ? `CAFFEINE ${secondsLeft}s` : ''));
    this.listen('banner', ({ title, line, holdMs }) => this.showBanner(title, line, holdMs));
    this.listen('player:died', () => this.showBanner('SURVIVOR OFFLINE', 'Glacier wins this round.'));
    this.listen('game:won', ({ stats }) =>
      this.showBanner('GLACIER DEFEATED', `The network is back in human hands. Allied software runs again. ${stats.pln} PLN left, ${stats.items.length} items.`, 5200),
    );
  }

  private listen<K extends GameEventName>(name: K, handler: (payload: GameEvents[K]) => void): void {
    on(this.game, name, handler, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => off(this.game, name, handler, this));
  }

  private onLevelReady({ dungeon, level, levelCount }: GameEvents['level:ready']): void {
    this.dungeon = dungeon;
    this.info.setText(`Level ${level}/${levelCount}: ${dungeon.level.name} · seed ${dungeon.seed}`);
    this.showBanner(`LEVEL ${level}: ${dungeon.level.name.toUpperCase()}`, dungeon.level.intro);
  }

  private onStats({ stats }: GameEvents['stats:changed']): void {
    while (this.hearts.length < Math.ceil(stats.maxHp / 2)) {
      this.hearts.push(this.add.image(PAD + 8 + this.hearts.length * 15, PAD + 9, TEX.icons, 'heart'));
    }
    // One heart icon is worth 2 HP; a half heart is drawn as a dimmed full one.
    this.hearts.forEach((h, i) => {
      const hp = stats.hp - i * 2;
      h.setVisible(i < Math.ceil(stats.maxHp / 2));
      h.setFrame(hp > 0 ? 'heart' : 'heart-empty').setAlpha(hp === 1 ? 0.55 : 1);
    });
    this.pens.setText(`${stats.pens}`).setColor(stats.pens === 0 ? PAL.red : PAL.white);
    this.pln.setText(`${stats.pln} PLN`);
    this.itemList.setText(stats.items.length ? `Items: ${stats.items.length} [I]` : '');
  }

  private onToast({ text, color: fill }: GameEvents['toast']): void {
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setText(text).setColor(fill ?? PAL.white).setAlpha(1);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1800, duration: 500 });
  }

  private onBossHealth({ name, hp, max, visible }: GameEvents['boss:health']): void {
    this.bossBar.clear();
    this.bossLabel.setVisible(visible).setText(name);
    if (!visible) return;
    const w = 160;
    const x = (VIEW_W - w) / 2;
    const y = PAD + 18;
    this.bossBar.fillStyle(color(PAL.black), 0.8).fillRect(x - 2, y - 2, w + 4, 10);
    this.bossBar.fillStyle(color(PAL.navy), 1).fillRect(x, y, w, 6);
    this.bossBar.fillStyle(color(PAL.cyan), 1).fillRect(x, y, Math.max(0, (w * hp) / max), 6);
  }

  private showBanner(title: string, line: string, holdMs = 2600): void {
    const [t, l] = this.banner.list as Phaser.GameObjects.Text[];
    t.setText(title);
    l.setText(line);
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(0);
    this.tweens.chain({
      targets: this.banner,
      tweens: [
        { alpha: 1, duration: 400 },
        { alpha: 1, duration: holdMs },
        { alpha: 0, duration: 600 },
      ],
    });
  }

  private onRoomEntered({ room, visited }: GameEvents['room:entered']): void {
    if (this.dungeon) this.drawMinimap(this.dungeon, room, visited);
  }

  private drawMinimap(dungeon: Dungeon, current: Room, visited: ReadonlySet<number>): void {
    const g = this.map.clear();
    const cols = RADIUS_X * 2 + 1;
    const rows = RADIUS_Y * 2 + 1;
    const w = cols * (CELL_W + GAP) + GAP;
    const h = rows * (CELL_H + GAP) + GAP;
    const ox = VIEW_W - PAD - w;
    const oy = PAD;

    g.fillStyle(color(PAL.black), 0.6).fillRect(ox, oy, w, h);

    // A room is shown once visited, or once a visited room has a door into it.
    const known = new Set<Room>();
    for (const r of dungeon.rooms) {
      if (!visited.has(r.id)) continue;
      known.add(r);
      for (const d of DIRS) {
        if (!r.doors[d]) continue;
        const n = findRoomAt(dungeon, r.gx + DIR_VEC[d].x, r.gy + DIR_VEC[d].y);
        if (n) known.add(n);
      }
    }

    for (const r of known) {
      const cx = r.gx - current.gx + RADIUS_X;
      const cy = r.gy - current.gy + RADIUS_Y;
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
      const x = ox + GAP + cx * (CELL_W + GAP);
      const y = oy + GAP + cy * (CELL_H + GAP);
      const fill = r === current ? PAL.white : visited.has(r.id) ? PAL.silver : PAL.grey;
      g.fillStyle(color(fill), 1).fillRect(x, y, CELL_W, CELL_H);

      const icon = r.type === 'boss' ? PAL.cyan : r.type === 'treasure' ? PAL.lime : r.type === 'secret' ? PAL.yellow : null;
      if (icon) g.fillStyle(color(icon), 1).fillRect(x + CELL_W / 2 - 2, y + CELL_H / 2 - 2, 4, 4);
    }
  }
}
