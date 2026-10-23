/** Global constants. Everything that is measured in pixels or tiles lives here. */
export const TILE = 16;

/** Room size in tiles, walls included. Odd numbers so doors sit in the exact middle. */
export const ROOM_W = 15;
export const ROOM_H = 11;

/** The dungeon is laid out on a grid of GRID x GRID room slots. */
export const GRID = 11;

/** Internal render size is 2x the room, the main camera zooms in 2x. Keeps UI text crisp. */
export const ZOOM = 2;
export const VIEW_W = ROOM_W * TILE * ZOOM;
export const VIEW_H = ROOM_H * TILE * ZOOM;

export const PLAYER_SPEED = 80;
