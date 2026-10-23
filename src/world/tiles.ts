/** Tile indices into the generated tileset texture (see gfx/textures.ts). */
export const T = {
  FLOOR: 0, // carpet tiles
  FLOOR_ALT: 1, // carpet with scattered paper
  WALL: 2,
  WINDOW: 3, // wall with a cracked window
  DESK: 4,
  DESK_PC: 5, // desk with a monitor
  CABINET: 6, // filing cabinet
  PLANT: 7, // dried-out office plant
  SERVER: 8, // server rack
  DOOR: 9,
  VOID: 10,
  FLOOR_BOSS: 11, // server room raised floor, frosted by Glacier
  FLOOR_TREASURE: 12, // break room linoleum
  CABINET_OPEN: 13, // already searched
  DESK_PC_OFF: 14, // already searched, monitor smashed
  DOOR_LOCKED: 15, // shutter that closes while enemies are in the room
  DESK_BARE: 16, // desk with the pens already taken
  DESK_PC_GLACIER: 17, // computer running Glacier's verification: minigame, alarm on failure
  VENDING: 18, // vending machine: spend PLN
  FLOWERS: 19, // potted flowers: breakable
  BOXES: 20, // stack of moving boxes: breakable
  CHAIR: 21, // knocked-over office chair: breakable
  FLOOR_PARKING: 22, // underground car park asphalt
  PARKING_LINE: 23, // asphalt with a painted bay line
  PILLAR: 24, // concrete column
  CAR_TOP: 25, // abandoned car, front half (cars are two tiles tall)
  CAR_BOTTOM: 26, // abandoned car, back half
  WALL_CRACKED: 27, // cracked wall hiding the secret room: smash it to open a door
  WALL_SIGN: 28, // wall with a parking sign
  CAMERA_PC: 29, // CCTV control computer: shuts the room's security camera down
  COFFEE_MACHINE: 30, // rare espresso machine: a short caffeine boost
  COFFEE_MACHINE_EMPTY: 31, // already used
  COOLING_UNIT: 32, // floor air conditioner, switched off by Glacier: the room overheats until it is restarted
  COOLING_UNIT_ON: 33, // running again
} as const;

export type TileId = (typeof T)[keyof typeof T];

export const TILE_COUNT = 34;

export const SOLID_TILES: readonly TileId[] = [
  T.WALL, T.WINDOW, T.WALL_CRACKED, T.WALL_SIGN, T.PILLAR, T.CAR_TOP, T.CAR_BOTTOM, T.CAMERA_PC, T.COFFEE_MACHINE, T.COFFEE_MACHINE_EMPTY, T.COOLING_UNIT, T.COOLING_UNIT_ON, T.DESK, T.DESK_PC, T.CABINET, T.PLANT, T.SERVER, T.VOID,
  T.CABINET_OPEN, T.DESK_PC_OFF, T.DOOR_LOCKED, T.DESK_BARE, T.DESK_PC_GLACIER, T.VENDING,
  T.FLOWERS, T.BOXES, T.CHAIR,
];

/** Furniture is drawn on its own layer, on top of the room's floor. */
export const FURNITURE_TILES: readonly TileId[] = [
  T.DESK, T.DESK_PC, T.CABINET, T.PLANT, T.SERVER, T.CABINET_OPEN, T.DESK_PC_OFF, T.DESK_BARE, T.DESK_PC_GLACIER, T.VENDING,
  T.FLOWERS, T.BOXES, T.CHAIR, T.PILLAR, T.CAR_TOP, T.CAR_BOTTOM, T.CAMERA_PC,
  T.COFFEE_MACHINE, T.COFFEE_MACHINE_EMPTY, T.COOLING_UNIT, T.COOLING_UNIT_ON,
];

/** Furniture the player can search, and what it turns into afterwards. */
export const SEARCHABLE: Partial<Record<number, number>> = {
  [T.CABINET]: T.CABINET_OPEN,
  [T.DESK_PC]: T.DESK_PC_OFF,
  [T.DESK]: T.DESK_BARE,
  [T.DESK_PC_GLACIER]: T.DESK_PC_OFF,
  [T.CAMERA_PC]: T.DESK_PC_OFF,
};

/** Clutter that blocks the way until the player smashes it (badge or pens): tile -> hits needed. */
export const BREAKABLE: Partial<Record<number, number>> = {
  [T.PLANT]: 2,
  [T.FLOWERS]: 1,
  [T.BOXES]: 3,
  [T.CHAIR]: 2,
  [T.WALL_CRACKED]: 2,
};

export function isBreakable(tile: number): boolean {
  return BREAKABLE[tile] !== undefined;
}

export function isFurniture(tile: number): boolean {
  return FURNITURE_TILES.includes(tile as TileId);
}

export function isWalkable(tile: number): boolean {
  return !SOLID_TILES.includes(tile as TileId);
}
