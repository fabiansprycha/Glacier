import type Phaser from 'phaser';
import type { PlayerStats } from './stats';
import type { Dungeon, Room } from '../world/dungeon';

/**
 * Names and payloads of game-wide events (emitted on game.events).
 * Scenes talk to each other only through these, so new systems (HUD, audio,
 * achievements...) can listen in without touching gameplay code.
 */
export interface GameEvents {
  /** A level was generated; `level` counts from 1. */
  'level:ready': { dungeon: Dungeon; level: number; levelCount: number };
  'room:entered': { room: Room; visited: ReadonlySet<number> };
  'stats:changed': { stats: Readonly<PlayerStats> };
  /** Short message at the bottom of the screen (loot, room cleared...). */
  toast: { text: string; color?: string };
  /** Context hint for the interact key; null hides it. */
  prompt: { text: string | null };
  /** Big centered title with a line of text (level start, secret room...). */
  banner: { title: string; line: string; holdMs?: number };
  /** Seconds left on the caffeine boost; null when it is over. */
  boost: { secondsLeft: number | null };
  'boss:health': { name: string; hp: number; max: number; visible: boolean };
  'player:died': { level: number };
  /** Glacier is down: the run is won. */
  'game:won': { stats: Readonly<PlayerStats> };
}

export type GameEventName = keyof GameEvents;

export function emit<K extends GameEventName>(game: Phaser.Game, name: K, payload: GameEvents[K]): void {
  game.events.emit(name, payload);
}

export function on<K extends GameEventName>(
  game: Phaser.Game,
  name: K,
  handler: (payload: GameEvents[K]) => void,
  context?: unknown,
): void {
  game.events.on(name, handler, context);
}

export function off<K extends GameEventName>(
  game: Phaser.Game,
  name: K,
  handler: (payload: GameEvents[K]) => void,
  context?: unknown,
): void {
  game.events.off(name, handler, context);
}
