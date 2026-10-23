import { ROOM_H, ROOM_W } from '../core/config';
import type { LevelDef } from '../core/levels';
import type { Rng } from '../core/rng';
import type { Dir, EnemySpawn, Room, SecurityCamera } from './dungeon';
import { cameraCanSeeTile } from './cameraVision';
import { T, isBreakable, isWalkable } from './tiles';

const MID_X = Math.floor(ROOM_W / 2);
const MID_Y = Math.floor(ROOM_H / 2);

/** Door tile (in the wall) for each side, in room-local tile coordinates. */
export const DOOR_POS: Record<Dir, { x: number; y: number }> = {
  n: { x: MID_X, y: 0 },
  s: { x: MID_X, y: ROOM_H - 1 },
  w: { x: 0, y: MID_Y },
  e: { x: ROOM_W - 1, y: MID_Y },
};

/** Room-local tile where pickups / bosses are placed. */
export const ROOM_CENTER = { x: MID_X, y: MID_Y };

type Prop = { x: number; y: number; tile: number };
type Furnish = (rng: Rng) => Prop[];

function rect(x0: number, y0: number, w: number, h: number, tile: number | ((x: number, y: number) => number)): Prop[] {
  const out: Prop[] = [];
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) out.push({ x, y, tile: typeof tile === 'number' ? tile : tile(x, y) });
  return out;
}

const corners = (tile: number): Prop[] => [
  { x: 1, y: 1, tile }, { x: ROOM_W - 2, y: 1, tile }, { x: 1, y: ROOM_H - 2, tile }, { x: ROOM_W - 2, y: ROOM_H - 2, tile },
];

/** Some desks have a monitor, some were cleared out. */
const desk = (rng: Rng) => () => (rng.chance(0.6) ? T.DESK_PC : T.DESK);

/** Furniture layouts for ordinary office rooms. Add new ones here; validation keeps them passable. */
const OFFICE_LAYOUTS: Furnish[] = [
  // Open space: two rows of desks on each side of the aisle.
  (rng) => [3, 7].flatMap((y) => [...rect(2, y, 4, 1, desk(rng)), ...rect(9, y, 4, 1, desk(rng))]),
  // Desk islands of four.
  (rng) => [[3, 2], [10, 2], [3, 7], [10, 7]].flatMap(([x, y]) => rect(x, y, 2, 2, desk(rng))),
  // Meeting room: long table, plants in the corners.
  () => [...rect(4, 4, 7, 3, T.DESK_BARE), ...corners(T.PLANT)],
  // Archive: cabinets along the top and bottom walls, a desk row in the middle.
  (rng) => [
    ...rect(2, 1, 4, 1, T.CABINET), ...rect(9, 1, 4, 1, T.CABINET),
    ...rect(2, ROOM_H - 2, 4, 1, T.CABINET), ...rect(9, ROOM_H - 2, 4, 1, T.CABINET),
    ...rect(3, MID_Y, 3, 1, desk(rng)), ...rect(9, MID_Y, 3, 1, desk(rng)),
  ],
  // Long open space: three short desk rows.
  (rng) => [2, 5, 8].flatMap((y) => [...rect(3, y, 3, 1, desk(rng)), ...rect(9, y, 3, 1, desk(rng))]),
  // Abandoned in a hurry: furniture pushed around everywhere.
  (rng) =>
    Array.from({ length: rng.int(6, 11) }, () => ({
      x: rng.int(2, ROOM_W - 3),
      y: rng.int(2, ROOM_H - 3),
      tile: rng.pick([T.DESK, T.DESK_PC, T.CABINET, T.PLANT, T.DESK]),
    })),
];

const SPECIAL_LAYOUTS: Record<Exclude<Room['type'], 'normal'> | 'glacier', Furnish> = {
  // Reception: a front desk, a couple of cabinets and dried-out plants.
  start: (rng) => [
    ...corners(T.PLANT), ...rect(5, 2, 5, 1, desk(rng)),
    { x: 2, y: 4, tile: T.CABINET }, { x: ROOM_W - 3, y: 4, tile: T.CABINET },
  ],
  treasure: () => [...corners(T.PLANT), ...rect(2, 1, 2, 1, T.CABINET)],
  // Mid-level bosses fight in an emptied-out office.
  boss: () => corners(T.PLANT),
  // Glacier's server room: racks along the walls.
  // Underground car park: bay lines, abandoned cars nose to the wall, concrete pillars.
  secret: (rng) => [
    ...[1, 8].flatMap((y) => [2, 4, 6, 8, 10, 12].flatMap((x) => rect(x, y, 1, 2, T.PARKING_LINE))),
    ...[3, 5, 9, 11].flatMap((x) => [
      ...(rng.chance(0.7) ? [{ x, y: 1, tile: T.CAR_TOP }, { x, y: 2, tile: T.CAR_BOTTOM }] : []),
      ...(rng.chance(0.7) ? [{ x, y: 8, tile: T.CAR_TOP }, { x, y: 9, tile: T.CAR_BOTTOM }] : []),
    ]),
    { x: 3, y: MID_Y, tile: T.PILLAR }, { x: ROOM_W - 4, y: MID_Y, tile: T.PILLAR },
  ],
  glacier: () => [2, 4, 6, 8].flatMap((y) => [...rect(2, y, 2, 1, T.SERVER), ...rect(ROOM_W - 4, y, 2, 1, T.SERVER)]),
};

/** Glacier's own server room is the boss room of the last level. */
export function isGlacierRoom(room: Room, level: LevelDef): boolean {
  return room.type === 'boss' && level.boss === 'glacier';
}

export function floorTileFor(room: Room, level: LevelDef | null): number {
  if (level && isGlacierRoom(room, level)) return T.FLOOR_BOSS;
  if (room.type === 'secret') return T.FLOOR_PARKING;
  return room.type === 'treasure' ? T.FLOOR_TREASURE : T.FLOOR;
}

export function buildRoomTiles(room: Room, rng: Rng, level: LevelDef): number[][] {
  const floor = floorTileFor(room, level);

  const base = (): number[][] =>
    Array.from({ length: ROOM_H }, (_, y) =>
      Array.from({ length: ROOM_W }, (_, x) => {
        const edge = x === 0 || y === 0 || x === ROOM_W - 1 || y === ROOM_H - 1;
        const corner = (x === 0 || x === ROOM_W - 1) && (y === 0 || y === ROOM_H - 1);
        // No windows underground in the car park.
        if (edge) return !corner && room.type !== 'secret' && rng.chance(0.1) ? T.WINDOW : T.WALL;
        return floor === T.FLOOR && rng.chance(0.04) ? T.FLOOR_ALT : floor;
      }),
    );

  const furnish = (layout: Furnish): number[][] => {
    const tiles = base();
    for (const p of layout(rng)) {
      if (inDoorLane(p)) continue;
      // Some computers are Glacier's: searching them starts the verification minigame.
      tiles[p.y][p.x] = p.tile === T.DESK_PC && rng.chance(level.glacierPcChance) ? T.DESK_PC_GLACIER : p.tile;
    }
    if (room.type !== 'boss' && room.type !== 'secret') scatterClutter(tiles, rng);
    openDoors(tiles, room);
    if (room.type === 'secret') signEntrance(tiles, room);
    return tiles;
  };

  const type = room.type;
  const special = isGlacierRoom(room, level) ? 'glacier' : type;
  const layout = special === 'normal' ? () => rng.pick(OFFICE_LAYOUTS) : () => SPECIAL_LAYOUTS[special];
  for (let attempt = 0; attempt < 6; attempt++) {
    const tiles = furnish(layout());
    // Clutter may block the way: the player smashes through it.
    if (isFullyConnected(tiles, true)) return tiles;
  }
  return furnish(() => []);
}

function openDoors(tiles: number[][], room: Room): void {
  for (const dir of Object.keys(DOOR_POS) as Dir[]) {
    if (!room.doors[dir]) continue;
    const p = DOOR_POS[dir];
    tiles[p.y][p.x] = T.DOOR;
  }
}

const CLUTTER = [T.BOXES, T.BOXES, T.CHAIR, T.FLOWERS, T.FLOWERS];

/**
 * Breakable junk left behind in the evacuation: boxes, chairs and potted flowers scattered over the
 * floor, and sometimes a barricade across a door's path. Never right at a door or in the room's middle.
 */
function scatterClutter(tiles: number[][], rng: Rng): void {
  const free = (x: number, y: number) => {
    if (x < 1 || y < 1 || x > ROOM_W - 2 || y > ROOM_H - 2) return false;
    if (Math.abs(x - MID_X) <= 1 && Math.abs(y - MID_Y) <= 1) return false;
    if (Object.values(DOOR_POS).some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 2)) return false;
    return tiles[y][x] === T.FLOOR || tiles[y][x] === T.FLOOR_ALT;
  };
  const put = (x: number, y: number, tile: number): boolean => {
    if (!free(x, y)) return false;
    tiles[y][x] = tile;
    return true;
  };

  let left = rng.int(3, 6);
  for (let tries = 0; left > 0 && tries < 40; tries++) {
    if (put(rng.int(1, ROOM_W - 2), rng.int(1, ROOM_H - 2), rng.pick(CLUTTER))) left--;
  }

  if (rng.chance(0.5)) {
    // Barricade: a short wall of boxes and chairs three steps inside one door.
    const dir = rng.pick(Object.keys(DOOR_POS) as Dir[]);
    const d = DOOR_POS[dir];
    const vertical = dir === 'w' || dir === 'e';
    const cx = d.x + (dir === 'w' ? 3 : dir === 'e' ? -3 : 0);
    const cy = d.y + (dir === 'n' ? 3 : dir === 's' ? -3 : 0);
    for (let k = -1; k <= 1; k++) {
      put(vertical ? cx : cx + k, vertical ? cy + k : cy, rng.pick([T.BOXES, T.BOXES, T.CHAIR]));
    }
  }
}

/** Parking signs on the wall on both sides of the car park's entrance. */
function signEntrance(tiles: number[][], room: Room): void {
  for (const dir of Object.keys(DOOR_POS) as Dir[]) {
    if (!room.doors[dir]) continue;
    const p = DOOR_POS[dir];
    const along = dir === 'n' || dir === 's' ? { x: 1, y: 0 } : { x: 0, y: 1 };
    for (const k of [-1, 1]) tiles[p.y + along.y * k][p.x + along.x * k] = T.WALL_SIGN;
  }
}

/** Keeps the tile right inside each door free, so doors are never blocked. */
function inDoorLane(p: { x: number; y: number }): boolean {
  if (p.x === MID_X && (p.y <= 1 || p.y >= ROOM_H - 2)) return true;
  return p.y === MID_Y && (p.x <= 1 || p.x >= ROOM_W - 2);
}

/** True when every walkable tile can reach every other one (no sealed pockets, all doors reachable). */
export function isFullyConnected(tiles: number[][], breakablesPassable = false): boolean {
  const passable = (tile: number) => isWalkable(tile) || (breakablesPassable && isBreakable(tile));
  const walkable: { x: number; y: number }[] = [];
  for (let y = 0; y < tiles.length; y++)
    for (let x = 0; x < tiles[y].length; x++) if (passable(tiles[y][x])) walkable.push({ x, y });
  if (walkable.length === 0) return false;

  const seen = new Set<string>([`${walkable[0].x},${walkable[0].y}`]);
  const stack = [walkable[0]];
  while (stack.length) {
    const { x, y } = stack.pop()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      const k = `${nx},${ny}`;
      if (seen.has(k) || !passable(tiles[ny]?.[nx] ?? T.VOID)) continue;
      seen.add(k);
      stack.push({ x: nx, y: ny });
    }
  }
  return seen.size === walkable.length;
}

type Point = { x: number; y: number };

/** Floor tiles of an ordinary room at least `gap` steps away from every door. */
function openFloor(room: Room, gap: number, taken: Point[] = []): Point[] {
  const doors = (Object.keys(DOOR_POS) as Dir[]).filter((d) => room.doors[d]).map((d) => DOOR_POS[d]);
  const out: Point[] = [];
  for (let y = 2; y < ROOM_H - 2; y++)
    for (let x = 2; x < ROOM_W - 2; x++) {
      if (!isWalkable(room.tiles[y][x])) continue;
      if (doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) < gap)) continue;
      if (taken.some((t) => t.x === x && t.y === y)) continue;
      out.push({ x, y });
    }
  return out;
}

/** Drone spawn tiles for an ordinary room: on the floor, away from the doors so the player gets a moment. */
export function pickEnemySpawns(room: Room, rng: Rng, level: LevelDef): EnemySpawn[] {
  if (room.type !== 'normal') return [];
  const candidates = openFloor(room, 4);
  const count = Math.min(rng.int(1, level.maxDrones), candidates.length);
  return rng
    .shuffle(candidates)
    .slice(0, count)
    .map((p) => ({ ...p, kind: rng.chance(level.printerChance) ? 'printer' : 'drone' }));
}

/** Electrified floor traps: never right inside a door and never under a drone. */
export function pickTraps(room: Room, rng: Rng, level: LevelDef): Point[] {
  if (room.type !== 'normal') return [];
  const candidates = openFloor(room, 3, room.enemies);
  const count = Math.min(rng.int(level.traps[0], level.traps[1]), candidates.length);
  return rng.shuffle(candidates).slice(0, count);
}

/** Picks a wall spot for a security camera, away from doors and corners, facing into the room. */
export function pickCamera(room: Room, rng: Rng): SecurityCamera {
  const spots: SecurityCamera[] = [];
  for (let x = 2; x <= ROOM_W - 3; x++) {
    spots.push({ x, y: 0, facing: Math.PI / 2 }, { x, y: ROOM_H - 1, facing: -Math.PI / 2 });
  }
  for (let y = 2; y <= ROOM_H - 3; y++) {
    spots.push({ x: 0, y, facing: 0 }, { x: ROOM_W - 1, y, facing: Math.PI });
  }
  const doors = (Object.keys(DOOR_POS) as Dir[]).filter((d) => room.doors[d]).map((d) => DOOR_POS[d]);
  const free = spots.filter((s) => doors.every((d) => Math.abs(d.x - s.x) + Math.abs(d.y - s.y) > 2));
  return rng.pick(free);
}

/**
 * Mounts a camera and puts its CCTV computer somewhere the camera can never see, with a free tile
 * next to it (also out of sight) so the player can shut the camera down unseen. Edits the room's
 * tiles; returns null when no camera spot has a safe place for the computer.
 */
export function placeCamera(room: Room, rng: Rng): { camera: SecurityCamera; pc: Point } | null {
  for (let attempt = 0; attempt < 8; attempt++) {
    const camera = pickCamera(room, rng);
    const safe = (x: number, y: number) => !cameraCanSeeTile(camera, x, y);
    const spots: Point[] = [];
    for (let y = 1; y < ROOM_H - 1; y++)
      for (let x = 1; x < ROOM_W - 1; x++) {
        if (inDoorLane({ x, y }) || !isWalkable(room.tiles[y][x]) || !safe(x, y)) continue;
        const standable = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(
          ([dx, dy]) => isWalkable(room.tiles[y + dy]?.[x + dx] ?? T.WALL) && safe(x + dx, y + dy),
        );
        if (standable) spots.push({ x, y });
      }
    for (const pc of rng.shuffle(spots)) {
      const before = room.tiles[pc.y][pc.x];
      room.tiles[pc.y][pc.x] = T.CAMERA_PC;
      if (isFullyConnected(room.tiles, true)) return { camera, pc };
      room.tiles[pc.y][pc.x] = before;
    }
  }
  return null;
}

/** Puts a vending machine against the top or bottom wall. Returns its tile, or null if nothing fits. */
export function placeVending(room: Room, rng: Rng): Point | null {
  const spots: Point[] = [];
  for (let x = 2; x <= ROOM_W - 3; x++) {
    if (Math.abs(x - MID_X) <= 1) continue;
    spots.push({ x, y: 1 }, { x, y: ROOM_H - 2 });
  }
  const busy = [...room.enemies, ...room.traps];
  for (const spot of rng.shuffle(spots)) {
    if (room.tiles[spot.y][spot.x] !== floorTileFor(room, null) && room.tiles[spot.y][spot.x] !== T.FLOOR_ALT) continue;
    if (busy.some((b) => b.x === spot.x && b.y === spot.y)) continue;
    const before = room.tiles[spot.y][spot.x];
    room.tiles[spot.y][spot.x] = T.VENDING;
    if (isFullyConnected(room.tiles, true)) return spot;
    room.tiles[spot.y][spot.x] = before;
  }
  return null;
}
