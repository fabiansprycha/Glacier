import { GRID, ROOM_H, ROOM_W } from '../core/config';
import type { LevelDef } from '../core/levels';
import { Rng } from '../core/rng';
import { DOOR_POS, buildRoomTiles, floorTileFor, placeCamera, pickEnemySpawns, pickTraps, placeVending } from './roomLayout';
import { T, isFurniture } from './tiles';

export type Dir = 'n' | 's' | 'e' | 'w';
export const DIRS: readonly Dir[] = ['n', 's', 'e', 'w'];
export const DIR_VEC: Record<Dir, { x: number; y: number }> = {
  n: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  e: { x: 1, y: 0 },
  w: { x: -1, y: 0 },
};
export const OPPOSITE: Record<Dir, Dir> = { n: 's', s: 'n', e: 'w', w: 'e' };

export type RoomType = 'start' | 'normal' | 'treasure' | 'boss' | 'secret';

export type EnemyKind = 'drone' | 'printer';
export interface EnemySpawn {
  x: number;
  y: number;
  kind: EnemyKind;
}

export interface Room {
  id: number;
  /** Position on the room grid (not in tiles). */
  gx: number;
  gy: number;
  type: RoomType;
  /** Distance from the start room, in rooms. */
  depth: number;
  doors: Record<Dir, boolean>;
  /** ROOM_H rows of ROOM_W tile ids, walls included. */
  tiles: number[][];
  /** Room-local tiles where Glacier's drones start. */
  enemies: EnemySpawn[];
  /** Room-local tiles with electrified floor traps. */
  traps: { x: number; y: number }[];
  /** Security camera on a wall tile, looking into the room. Only in rooms without drones. */
  camera: SecurityCamera | null;
  /** The CCTV computer that shuts the camera down; always out of the camera's sight. */
  cameraPc: { x: number; y: number } | null;
  /** Vending machine tile, if the room has one. */
  vending: { x: number; y: number } | null;
  /** Wall side hiding the way into the secret room (a cracked wall until smashed). */
  secretDoor?: Dir;
}

export interface SecurityCamera {
  /** Wall tile, room-local. */
  x: number;
  y: number;
  /** Direction it faces at rest, in radians (0 = east, PI/2 = south). */
  facing: number;
}

export interface Dungeon {
  seed: number;
  level: LevelDef;
  rooms: Room[];
  start: Room;
  boss: Room;
  treasure: Room;
  /** Hidden underground car park, reached by smashing a cracked wall. */
  secret: Room | null;
}

export interface DungeonOptions {
  seed: number;
  /** Room count, enemies, traps and boss all come from the level definition. */
  level: LevelDef;
}

/**
 * Builds a floor as a tree of rooms on a grid (similar to The Binding of Isaac):
 * rooms grow outward from the start room, a new room may only touch its parent,
 * so every adjacency is a door and the layout never forms blobs.
 * The farthest dead end becomes the boss room, another dead end the treasure room.
 */
export function generateDungeon({ seed, level }: DungeonOptions): Dungeon {
  const rng = new Rng(seed);
  const roomCount = level.roomCount;
  if (roomCount < 3) throw new Error('roomCount must be at least 3');

  for (let attempt = 0; attempt < 500; attempt++) {
    const layout = growLayout(rng, roomCount);
    if (!layout) continue;

    const deadEnds = layout.filter((r) => r.type !== 'start' && doorCount(r) === 1);
    if (deadEnds.length < 2) continue;

    const maxDepth = Math.max(...deadEnds.map((r) => r.depth));
    const boss = rng.pick(deadEnds.filter((r) => r.depth === maxDepth));
    boss.type = 'boss';
    const treasure = rng.pick(deadEnds.filter((r) => r !== boss));
    treasure.type = 'treasure';

    for (const room of layout) {
      room.tiles = buildRoomTiles(room, rng, level);
      // Some ordinary rooms trade their drones for a camera that calls them in.
      const watched = room.type === 'normal' && rng.chance(level.cameraChance) ? placeCamera(room, rng) : null;
      room.camera = watched?.camera ?? null;
      room.cameraPc = watched?.pc ?? null;
      room.enemies = room.camera ? [] : pickEnemySpawns(room, rng, level);
      room.traps = pickTraps(room, rng, level);
    }

    // Two vending machines per level, in ordinary rooms (the start room as a last resort).
    const hosts = [...rng.shuffle(layout.filter((r) => r.type === 'normal')), layout[0]];
    let machines = 0;
    for (const room of hosts) {
      if (machines === 2) break;
      room.vending = placeVending(room, rng);
      if (room.vending) machines++;
    }

    const secret = level.secretRoom ? addSecretRoom(layout, rng, level) : null;
    if (level.secretRoom && !secret) continue;

    return { seed, level, rooms: layout, start: layout[0], boss, treasure, secret };
  }
  throw new Error(`Could not generate a dungeon for seed ${seed}`);
}

function growLayout(rng: Rng, roomCount: number): Room[] | null {
  const grid = new Map<string, Room>();
  const key = (x: number, y: number) => `${x},${y}`;
  const occupied = (x: number, y: number) => grid.has(key(x, y));
  const inBounds = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID;

  const center = Math.floor(GRID / 2);
  const start = makeRoom(0, center, center, 'start', 0);
  grid.set(key(center, center), start);
  const rooms = [start];
  const queue = [start];

  for (let steps = 0; queue.length > 0 && rooms.length < roomCount && steps < 1000; steps++) {
    const current = queue.shift()!;
    for (const dir of rng.shuffle([...DIRS])) {
      if (rooms.length >= roomCount) break;
      const nx = current.gx + DIR_VEC[dir].x;
      const ny = current.gy + DIR_VEC[dir].y;
      if (!inBounds(nx, ny) || occupied(nx, ny)) continue;
      const neighbours = DIRS.filter((d) => occupied(nx + DIR_VEC[d].x, ny + DIR_VEC[d].y)).length;
      if (neighbours > 1) continue;
      if (rng.chance(0.5)) continue;

      const room = makeRoom(rooms.length, nx, ny, 'normal', current.depth + 1);
      current.doors[dir] = true;
      room.doors[OPPOSITE[dir]] = true;
      grid.set(key(nx, ny), room);
      rooms.push(room);
      queue.push(room);
    }
    // If the frontier dies out too early, keep growing from a random existing room.
    if (queue.length === 0 && rooms.length < roomCount) queue.push(rng.pick(rooms));
  }
  return rooms.length === roomCount ? rooms : null;
}

/**
 * Hides one extra room next to an ordinary room. It is not part of the door tree: the host's
 * wall shows a crack where the door would be, and smashing it opens the way in.
 */
function addSecretRoom(layout: Room[], rng: Rng, level: LevelDef): Room | null {
  const taken = new Set(layout.map((r) => `${r.gx},${r.gy}`));
  const spots: { host: Room; dir: Dir; gx: number; gy: number }[] = [];
  for (const host of layout) {
    if (host.type !== 'normal') continue;
    for (const dir of DIRS) {
      const gx = host.gx + DIR_VEC[dir].x;
      const gy = host.gy + DIR_VEC[dir].y;
      if (host.doors[dir] || gx < 0 || gy < 0 || gx >= GRID || gy >= GRID || taken.has(`${gx},${gy}`)) continue;
      spots.push({ host, dir, gx, gy });
    }
  }
  if (spots.length === 0) return null;
  const { host, dir, gx, gy } = rng.pick(spots);
  const room = makeRoom(layout.length, gx, gy, 'secret', host.depth + 1);
  room.doors[OPPOSITE[dir]] = true;
  room.tiles = buildRoomTiles(room, rng, level);
  host.secretDoor = dir;
  const p = DOOR_POS[dir];
  host.tiles[p.y][p.x] = T.WALL_CRACKED;
  layout.push(room);
  return room;
}

function makeRoom(id: number, gx: number, gy: number, type: RoomType, depth: number): Room {
  return { id, gx, gy, type, depth, doors: { n: false, s: false, e: false, w: false }, tiles: [], enemies: [], traps: [], camera: null, cameraPc: null, vending: null };
}

export function doorCount(room: Room): number {
  return DIRS.filter((d) => room.doors[d]).length;
}

export function findRoomAt(dungeon: Dungeon, gx: number, gy: number): Room | undefined {
  return dungeon.rooms.find((r) => r.gx === gx && r.gy === gy);
}

export interface FloorLayers {
  /** Floors, walls and doors. Under furniture this holds the room's plain floor. */
  base: number[][];
  /** Furniture only, -1 everywhere else. */
  props: number[][];
}

/** Whole-floor tile layers: GRID*ROOM_H rows by GRID*ROOM_W columns. Empty slots are `voidTile`. */
export function buildFloorLayers(dungeon: Dungeon, voidTile: number): FloorLayers {
  const grid = (fill: number) => Array.from({ length: GRID * ROOM_H }, () => new Array<number>(GRID * ROOM_W).fill(fill));
  const base = grid(voidTile);
  const props = grid(-1);
  for (const room of dungeon.rooms) {
    for (let y = 0; y < ROOM_H; y++) {
      for (let x = 0; x < ROOM_W; x++) {
        const tile = room.tiles[y][x];
        const wy = room.gy * ROOM_H + y;
        const wx = room.gx * ROOM_W + x;
        if (isFurniture(tile)) {
          base[wy][wx] = floorTileFor(room, dungeon.level);
          props[wy][wx] = tile;
        } else {
          base[wy][wx] = tile;
        }
      }
    }
  }
  return { base, props };
}
