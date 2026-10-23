import Phaser from 'phaser';
import { TILE } from '../core/config';
import { Rng } from '../core/rng';
import { T, TILE_COUNT } from '../world/tiles';
import { PAL, drawPixels } from './pixels';
import type { HeroClass } from '../core/classes';
import { BOSSES, CAMERA, DRONE, ELEVATOR, FX, GLACIER, HERO_COLORS, HERO_FRAMES, HERO_SHIRTS, ICONS, TERMINAL } from './sprites';

export const TEX = {
  tiles: 'tiles',
  hero: 'hero',
  terminal: 'terminal',
  glacier: 'glacier',
  elevator: 'elevator',
  drone: 'drone',
  fx: 'fx',
  icons: 'icons',
  bosses: 'bosses',
  trap: 'trap',
  camera: 'camera',
} as const;

/** Hero spritesheet for a class: same frames, different shirt. */
export function heroTexture(cls: HeroClass): string {
  return `${TEX.hero}-${cls}`;
}

/** Generates every placeholder texture at boot, so the prototype needs no asset files. */
export function createTextures(scene: Phaser.Scene): void {
  createTileset(scene);
  for (const cls of Object.keys(HERO_SHIRTS) as HeroClass[]) {
    createSheet(scene, heroTexture(cls), HERO_FRAMES, { ...HERO_COLORS, c: HERO_SHIRTS[cls] });
  }
  createSheet(scene, TEX.terminal, [{ name: '0', rows: TERMINAL.rows }], TERMINAL.colors);
  createSheet(scene, TEX.glacier, [{ name: '0', rows: GLACIER.rows }], GLACIER.colors);
  createSheet(scene, TEX.elevator, [{ name: '0', rows: ELEVATOR.rows }], ELEVATOR.colors);
  createSheet(scene, TEX.drone, DRONE.frames, DRONE.colors);
  createSheet(scene, TEX.fx, FX.frames, FX.colors);
  createSheet(scene, TEX.icons, ICONS.frames, ICONS.colors);
  createSheet(scene, TEX.bosses, BOSSES.frames, BOSSES.colors);
  createSheet(scene, TEX.camera, CAMERA.frames, CAMERA.colors);
  createTrapSheet(scene);
}

/** Electrified floor plate: frames 'off', 'warn' (sparks) and 'on' (arcing). */
function createTrapSheet(scene: Phaser.Scene): void {
  const tex = scene.textures.createCanvas(TEX.trap, TILE * 3, TILE)!;
  const ctx = tex.getContext();
  const rng = new Rng(99);
  ['off', 'warn', 'on'].forEach((name, i) => {
    const ox = i * TILE;
    const box = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(ox + x, y, w, h);
    };
    box(1, 1, 14, 14, PAL.black);
    box(2, 2, 12, 12, PAL.grey);
    // Hazard stripes along the edge.
    for (let x = 2; x < 14; x += 4) {
      box(x, 2, 2, 1, PAL.yellow);
      box(x + 2, 13, 2, 1, PAL.yellow);
    }
    box(4, 4, 8, 8, PAL.slate);
    // Torn cable across the plate.
    box(3, 8, 4, 1, PAL.black);
    box(9, 7, 4, 1, PAL.black);
    box(6, 8, 1, 1, PAL.orange);
    box(9, 7, 1, 1, PAL.orange);
    if (name === 'warn') {
      for (let n = 0; n < 4; n++) box(rng.int(5, 10), rng.int(5, 10), 1, 1, PAL.yellow);
    }
    if (name === 'on') {
      box(4, 4, 8, 8, PAL.sky);
      const arc = [[3, 3], [5, 5], [6, 4], [8, 6], [9, 5], [11, 8], [10, 10], [12, 12], [7, 9], [5, 11], [4, 12]];
      arc.forEach(([x, y]) => box(x, y, 1, 1, PAL.white));
      [[7, 7], [8, 8], [6, 8], [9, 7]].forEach(([x, y]) => box(x, y, 1, 1, PAL.cyan));
    }
    tex.add(name, 0, ox, 0, TILE, TILE);
  });
  tex.refresh();
}

function createSheet(
  scene: Phaser.Scene,
  key: string,
  frames: { name: string; rows: string[] }[],
  colors: Record<string, string>,
): void {
  const tex = scene.textures.createCanvas(key, TILE * frames.length, TILE)!;
  const ctx = tex.getContext();
  frames.forEach((f, i) => {
    drawPixels(ctx, f.rows, colors, i * TILE, 0);
    tex.add(f.name, 0, i * TILE, 0, TILE, TILE);
  });
  tex.refresh();
}

/** Office tileset, one 16x16 tile per T entry, in index order. */
function createTileset(scene: Phaser.Scene): void {
  const tex = scene.textures.createCanvas(TEX.tiles, TILE * TILE_COUNT, TILE)!;
  const ctx = tex.getContext();
  const rng = new Rng(1234);
  let ox = 0;
  const px = (x: number, y: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + x, y, 1, 1);
  };
  const box = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + x, y, w, h);
  };
  const sprite = (rows: string[], colors: Record<string, string>) => drawPixels(ctx, rows, colors, ox, 0);

  const carpet = () => {
    box(0, 0, TILE, TILE, PAL.slate);
    for (let y = 0; y < TILE; y++)
      for (let x = 0; x < TILE; x++) {
        if ((x * 7 + y * 13) % 11 === 0) px(x, y, PAL.navy);
        else if ((x * 5 + y * 3) % 23 === 0) px(x, y, PAL.grey);
      }
    for (let i = 0; i < TILE; i++) {
      px(i, 0, PAL.navy);
      px(0, i, PAL.navy);
    }
  };

  const draw: Record<number, () => void> = {
    [T.FLOOR]: carpet,
    [T.FLOOR_ALT]: () => {
      carpet();
      // A dropped sheet of paper.
      box(5, 6, 6, 7, PAL.grey);
      box(6, 5, 6, 7, PAL.silver);
      for (const y of [7, 9]) box(7, y, 4, 1, PAL.grey);
    },
    [T.WALL]: () => {
      box(0, 0, TILE, TILE, PAL.grey);
      box(0, 0, TILE, 2, PAL.silver);
      box(0, TILE - 3, TILE, 3, PAL.slate);
      for (let i = 0; i < 5; i++) px(rng.int(0, 15), rng.int(3, 12), PAL.slate);
    },
    [T.WINDOW]: () => {
      // Window onto the dead city at night.
      box(0, 0, TILE, TILE, PAL.silver);
      box(1, 1, 14, 14, PAL.black);
      box(2, 2, 12, 12, PAL.navy);
      box(3, 8, 3, 6, PAL.black);
      box(7, 6, 3, 8, PAL.black);
      box(11, 9, 3, 5, PAL.black);
      for (const [x, y] of [[4, 9], [8, 7], [8, 10], [12, 11]]) px(x, y, PAL.yellow);
      for (let i = 0; i < 4; i++) px(9 + i, 5 - i, PAL.blue);
      box(2, 7, 12, 1, PAL.silver); // window frame bar
    },
    [T.DESK_BARE]: () => {
      box(0, 2, TILE, 10, PAL.silver);
      box(0, 2, TILE, 1, PAL.white);
      box(0, 12, TILE, 2, PAL.grey);
      box(0, 14, TILE, 1, PAL.black);
    },
    [T.DESK]: () => {
      draw[T.DESK_BARE]();
      // Mug full of pens, and one lying next to it.
      box(3, 5, 4, 5, PAL.black);
      box(4, 6, 2, 3, PAL.red);
      box(4, 3, 1, 3, PAL.blue);
      box(5, 2, 1, 4, PAL.black);
      box(6, 3, 1, 3, PAL.red);
      box(9, 8, 5, 1, PAL.blue);
      box(13, 8, 1, 1, PAL.black);
    },
    [T.DESK_PC]: () => {
      draw[T.DESK_BARE]();
      box(3, 1, 10, 7, PAL.black);
      box(4, 2, 8, 5, PAL.navy);
      box(5, 3, 3, 1, PAL.teal); // dim text on a dead screen
      box(5, 5, 5, 1, PAL.teal);
      box(7, 8, 2, 1, PAL.black);
      box(4, 9, 8, 2, PAL.grey); // keyboard
      for (let x = 5; x < 11; x += 2) px(x, 9, PAL.slate);
    },
    [T.CABINET]: () => {
      box(2, 0, 12, 15, PAL.black);
      box(3, 1, 10, 13, PAL.grey);
      for (const y of [1, 5, 9]) {
        box(3, y + 3, 10, 1, PAL.slate);
        box(6, y + 1, 4, 1, PAL.silver);
      }
      box(2, 15, 12, 1, PAL.black);
    },
    [T.PLANT]: () => {
      sprite(
        [
          '................',
          '......y..t......',
          '...t..yt.t..y...',
          '....t.ytt..yy...',
          '..yy.tytyty.....',
          '....ttyyttt.ty..',
          '..t..ttyytt.t...',
          '...tttyttytt....',
          '.....ttyytt.....',
          '....kkkkkkkk....',
          '....kooooook....',
          '....kooooook....',
          '.....kooook.....',
          '.....kooook.....',
          '......kkkk......',
          '................',
        ],
        { t: PAL.teal, y: PAL.yellow, k: PAL.black, o: PAL.orange },
      );
    },
    [T.SERVER]: () => {
      box(0, 0, TILE, TILE, PAL.black);
      box(1, 0, 14, 15, PAL.slate);
      for (let y = 1; y < 15; y += 3) {
        box(2, y, 12, 2, PAL.black);
        px(3, y, rng.chance(0.7) ? PAL.cyan : PAL.red);
        px(5, y, rng.chance(0.5) ? PAL.cyan : PAL.navy);
        box(8, y + 1, 5, 1, PAL.grey);
      }
      // Frost creeping over the rack.
      for (let i = 0; i < 6; i++) px(rng.int(1, 14), rng.int(0, 3), PAL.white);
    },
    [T.DOOR]: () => {
      carpet();
      box(0, 0, TILE, 2, PAL.black);
      box(0, TILE - 2, TILE, 2, PAL.black);
      box(0, 0, 2, TILE, PAL.black);
      box(TILE - 2, 0, 2, TILE, PAL.black);
    },
    [T.VOID]: () => box(0, 0, TILE, TILE, PAL.black),
    [T.CABINET_OPEN]: () => {
      draw[T.CABINET]();
      box(3, 6, 10, 3, PAL.black); // drawer pulled out and emptied
      box(4, 9, 8, 1, PAL.silver);
    },
    // Looks exactly like any other computer: the player cannot tell which one is Glacier's.
    [T.DESK_PC_GLACIER]: () => draw[T.DESK_PC](),
    [T.VENDING]: () => {
      // Snack machine: red cabinet, glass front with snacks, keypad and a pickup slot.
      box(1, 0, 14, 16, PAL.black);
      box(2, 0, 12, 15, PAL.red);
      box(3, 1, 7, 10, PAL.navy);
      const snacks = [PAL.yellow, PAL.orange, PAL.lime, PAL.sky, PAL.white, PAL.orange];
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 3; col++) box(4 + col * 2, 2 + row * 3, 1, 2, snacks[(row * 3 + col) % snacks.length]);
      box(3, 1, 1, 10, PAL.blue); // glass glare
      box(11, 2, 2, 5, PAL.slate);
      for (const y of [3, 5]) box(11, y, 2, 1, PAL.silver);
      box(11, 8, 2, 1, PAL.lime);
      box(3, 12, 7, 2, PAL.black);
      box(2, 15, 12, 1, PAL.purple);
    },
    [T.FLOWERS]: () => {
      // Someone kept watering these: still in bloom.
      sprite(
        [
          '................',
          '....r.....y.....',
          '...rwr...ywy....',
          '....r.l...y.....',
          '..y..ll.lr...p..',
          '.ywy.lllrwr.pwp.',
          '..yl.l.l.r...p..',
          '...lll.ll.l.ll..',
          '....llllllllll..',
          '....kkkkkkkkk...',
          '....kssssssxk...',
          '....kssssssxk...',
          '.....kssssxk....',
          '.....kssssxk....',
          '......kkkkk.....',
          '................',
        ],
        { r: PAL.red, w: PAL.white, y: PAL.yellow, p: PAL.purple, l: PAL.green, k: PAL.black, s: PAL.sky, x: PAL.blue },
      );
    },
    [T.BOXES]: () => {
      // Two moving boxes, the top one taped shut.
      sprite(
        [
          '................',
          '...kkkkkkkkk....',
          '...kyyyyyyyok...',
          '...kyyyoyyyok...',
          '...kooooooook...',
          '...kyyyoyyyok...',
          '..kkkkkkkkkkkk..',
          '..kyyyyyyyyyyok.',
          '..kyyyyyyyyyyok.',
          '..kyykkkyyyyyok.',
          '..kyykwkyyyyyok.',
          '..kyykkkyyyyyok.',
          '..kyyyyyyyyyyok.',
          '..kooooooooooook',
          '..kkkkkkkkkkkkkk',
          '................',
        ],
        { k: PAL.black, y: PAL.orange, o: PAL.purple, w: PAL.white },
      );
    },
    [T.CHAIR]: () => {
      // Office chair lying on its side, wheels in the air.
      sprite(
        [
          '................',
          '................',
          '..kkkkkk........',
          '.kssssssk.......',
          '.ksbbbbsk.......',
          '.ksbbbbsk.......',
          '.ksbbbbskkkkkk..',
          '.ksbbbbskbbbbsk.',
          '.ksbbbbskbbbbsk.',
          '.kssssssksssssk.',
          '..kkkkkkkkkkkk..',
          '........kgk.....',
          '....kgggggggk...',
          '...kgk..kgk.kgk.',
          '...kk...kk...kk.',
          '................',
        ],
        { k: PAL.black, s: PAL.grey, b: PAL.navy, g: PAL.silver },
      );
    },
    [T.FLOOR_PARKING]: () => {
      box(0, 0, TILE, TILE, PAL.slate);
      for (let i = 0; i < 7; i++) px(rng.int(0, 15), rng.int(0, 15), PAL.grey);
      for (let i = 0; i < 4; i++) px(rng.int(0, 15), rng.int(0, 15), PAL.black);
    },
    [T.PARKING_LINE]: () => {
      draw[T.FLOOR_PARKING]();
      box(7, 0, 2, TILE, PAL.yellow);
      for (let y = 1; y < TILE; y += 4) px(7 + (y % 2), y, PAL.orange); // worn paint
    },
    [T.PILLAR]: () => {
      box(1, 0, 14, 16, PAL.black);
      box(2, 0, 12, 15, PAL.silver);
      box(2, 0, 2, 15, PAL.white);
      for (let x = 2; x < 14; x += 4) {
        box(x, 10, 2, 3, PAL.yellow);
        box(x + 2, 10, 2, 3, PAL.black);
      }
    },
    [T.CAR_TOP]: () => {
      // Front of a car parked nose to the wall: bonnet, windscreen, roof.
      box(2, 1, 12, 15, PAL.black);
      box(3, 2, 10, 14, PAL.blue);
      box(4, 2, 8, 1, PAL.sky);
      box(1, 4, 1, 3, PAL.black);
      box(14, 4, 1, 3, PAL.black);
      box(4, 9, 8, 4, PAL.navy); // windscreen
      box(5, 10, 2, 1, PAL.sky);
      box(4, 14, 8, 2, PAL.sky);
      for (let i = 0; i < 4; i++) px(rng.int(4, 11), rng.int(3, 8), PAL.silver); // dust
    },
    [T.CAR_BOTTOM]: () => {
      box(2, 0, 12, 15, PAL.black);
      box(3, 0, 10, 14, PAL.blue);
      box(4, 0, 8, 2, PAL.sky);
      box(4, 3, 8, 3, PAL.navy); // rear window
      box(1, 8, 1, 3, PAL.black);
      box(14, 8, 1, 3, PAL.black);
      box(3, 12, 2, 1, PAL.red);
      box(11, 12, 2, 1, PAL.red);
      for (let i = 0; i < 3; i++) px(rng.int(4, 11), rng.int(7, 11), PAL.silver);
    },
    [T.WALL_CRACKED]: () => {
      draw[T.WALL]();
      // A crack you can spot if you look: something is hollow behind this wall.
      for (const [x, y] of [[7, 3], [8, 4], [8, 5], [7, 6], [6, 7], [7, 8], [8, 9], [9, 10], [8, 11], [5, 8], [4, 9], [10, 5], [11, 4]]) px(x, y, PAL.black);
      px(9, 9, PAL.slate);
    },
    [T.WALL_SIGN]: () => {
      draw[T.WALL]();
      box(3, 3, 10, 10, PAL.white);
      box(4, 4, 8, 8, PAL.blue);
      // "P"
      box(6, 5, 1, 6, PAL.white);
      box(7, 5, 2, 1, PAL.white);
      box(9, 6, 1, 2, PAL.white);
      box(7, 8, 2, 1, PAL.white);
    },
    // Also identical to an ordinary computer: you only learn it runs the CCTV by searching it.
    [T.CAMERA_PC]: () => draw[T.DESK_PC](),
    [T.COFFEE_MACHINE]: () => {
      // Office espresso machine: steel body, red light on, a full cup under the spout, steam.
      box(2, 1, 12, 15, PAL.black);
      box(3, 2, 10, 13, PAL.silver);
      box(3, 2, 10, 3, PAL.grey);
      px(11, 3, PAL.red);
      px(9, 3, PAL.lime);
      box(5, 6, 6, 1, PAL.black); // spout
      box(4, 7, 8, 6, PAL.slate);
      box(6, 10, 4, 3, PAL.white); // cup
      box(7, 11, 2, 1, PAL.orange);
      px(7, 8, PAL.white);
      px(8, 9, PAL.white);
      box(3, 14, 10, 1, PAL.grey);
    },
    [T.COFFEE_MACHINE_EMPTY]: () => {
      draw[T.COFFEE_MACHINE]();
      box(4, 7, 8, 6, PAL.slate); // cup taken
      px(11, 3, PAL.grey);
      px(9, 3, PAL.grey);
    },
    [T.DESK_PC_OFF]: () => {
      draw[T.DESK_PC]();
      box(4, 2, 8, 5, PAL.black);
      [[5, 3], [6, 4], [7, 4], [8, 5], [9, 3], [10, 4]].forEach(([x, y]) => px(x, y, PAL.grey)); // cracked screen
    },
    [T.DOOR_LOCKED]: () => {
      // Security shutter.
      box(0, 0, TILE, TILE, PAL.black);
      box(1, 1, 14, 14, PAL.grey);
      for (let y = 2; y < 15; y += 3) box(1, y, 14, 1, PAL.slate);
      box(6, 6, 4, 4, PAL.red);
      box(7, 7, 2, 2, PAL.orange);
    },
    [T.FLOOR_BOSS]: () => {
      // Raised server room floor, frosted over by Glacier.
      box(0, 0, TILE, TILE, PAL.navy);
      for (let i = 0; i < TILE; i++) {
        px(i, 0, PAL.black);
        px(i, 8, PAL.black);
        px(0, i, PAL.black);
        px(8, i, PAL.black);
      }
      for (const [x, y] of [[3, 3], [5, 3], [3, 5], [5, 5], [11, 11], [13, 11], [11, 13], [13, 13]]) px(x, y, PAL.slate);
      for (let i = 0; i < 5; i++) px(rng.int(1, 15), rng.int(1, 15), rng.chance(0.5) ? PAL.cyan : PAL.white);
    },
    [T.FLOOR_TREASURE]: () => {
      // Break room linoleum.
      box(0, 0, TILE, TILE, PAL.slate);
      box(0, 0, 8, 8, PAL.grey);
      box(8, 8, 8, 8, PAL.grey);
      for (let i = 0; i < 3; i++) px(rng.int(0, 15), rng.int(0, 15), PAL.slate);
    },
  };

  for (let id = 0; id < TILE_COUNT; id++) {
    ox = id * TILE;
    draw[id]();
    // Frames named by tile id, so single tiles can also be shown as images (title screen).
    tex.add(id, 0, ox, 0, TILE, TILE);
  }
  tex.refresh();
}
