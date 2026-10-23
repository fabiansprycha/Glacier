import type Phaser from 'phaser';
import { emit } from '../core/events';
import type { PlayerStats } from '../core/stats';
import { PAL } from '../gfx/pixels';
import type { Room } from '../world/dungeon';

/** Bonus for clearing a deadline room in time. */
const DEADLINE_PLN = 4;
const DEADLINE_PENS = 3;
/** Drones Glacier adds when a deadline is missed. */
const SCOPE_CREEP = 2;
/** Heat gained per second in an overheating room, in percent: about 15 s to the danger zone. */
const HEAT_PER_SECOND = 6.5;
/** At full heat the player loses 1 HP this often. */
const HEATSTROKE_MS = 2200;
const COOLING_PLN = 3;

export interface RoomEventsHost {
  readonly game: Phaser.Game;
  readonly stats: PlayerStats;
  livingEnemies(room: Room): unknown[];
  raiseAlarm(room: Room, message: string, count: number): void;
  playerHit(damage: number): void;
  statsChanged(): void;
  toast(text: string, color?: string): void;
}

/**
 * Room events (see RoomEvent in world/dungeon.ts): a deadline to clear a room against the clock,
 * and an overheating room that hurts until its cooling unit is restarted. Shows its timer on the HUD.
 */
export class RoomEvents {
  private done = new Set<number>();
  private deadline: { room: Room; msLeft: number } | null = null;
  private heat = new Map<number, number>();
  private heatstrokeIn = 0;
  private shown: string | null = null;

  constructor(private readonly host: RoomEventsHost) {}

  /** The player is in the room and the camera has settled. */
  roomEntered(room: Room): void {
    const event = room.event;
    if (!event || this.done.has(room.id)) return;
    if (event.kind === 'deadline' && this.host.livingEnemies(room).length > 0 && !this.deadline) {
      this.deadline = { room, msLeft: event.seconds * 1000 };
      this.banner('DEADLINE', `Glacier scheduled this room for today. Clear it in ${event.seconds} s for a bonus.`);
    }
    if (event.kind === 'overheat' && !this.heat.has(room.id)) {
      this.heat.set(room.id, 0);
      this.banner('OVERHEATING', 'Glacier switched the air conditioning off. Restart the cooling unit before you cook.');
    }
  }

  /** The last enemy of the room is gone. */
  roomCleared(room: Room): void {
    if (this.deadline?.room !== room) return;
    this.deadline = null;
    this.done.add(room.id);
    const s = this.host.stats;
    s.pln += DEADLINE_PLN;
    s.pens = Math.min(s.maxPens, s.pens + DEADLINE_PENS);
    this.host.statsChanged();
    this.host.toast(`Shipped before the deadline! +${DEADLINE_PLN} PLN, +${DEADLINE_PENS} pens.`, PAL.lime);
  }

  coolingRestored(room: Room): void {
    if (room.event?.kind !== 'overheat' || this.done.has(room.id)) return;
    this.done.add(room.id);
    this.heat.delete(room.id);
    this.host.stats.pln += COOLING_PLN;
    this.host.statsChanged();
    this.host.toast(`Cold air again. Someone taped ${COOLING_PLN} PLN to the unit.`, PAL.cyan);
  }

  update(room: Room, deltaMs: number): void {
    let text: string | null = null;
    let fill: string = PAL.yellow;

    if (this.deadline) {
      const d = this.deadline;
      d.msLeft -= deltaMs;
      if (d.msLeft <= 0) {
        this.deadline = null;
        this.done.add(d.room.id);
        this.host.raiseAlarm(d.room, 'Deadline missed. Scope creep: Glacier adds more drones!', SCOPE_CREEP);
      } else {
        const left = Math.ceil(d.msLeft / 1000);
        text = `DEADLINE ${left}s`;
        fill = left <= 5 ? PAL.red : PAL.yellow;
      }
    }

    const heat = this.heat.get(room.id);
    if (heat !== undefined && !this.done.has(room.id)) {
      const next = Math.min(100, heat + (HEAT_PER_SECOND * deltaMs) / 1000);
      this.heat.set(room.id, next);
      if (next >= 100) {
        this.heatstrokeIn -= deltaMs;
        if (this.heatstrokeIn <= 0) {
          this.heatstrokeIn = HEATSTROKE_MS;
          this.host.toast('Heatstroke! Find the cooling unit.', PAL.red);
          this.host.playerHit(1);
        }
      } else {
        this.heatstrokeIn = 0;
      }
      const heatText = `HEAT ${Math.floor(next)}%`;
      text = text ? `${text} · ${heatText}` : heatText;
      if (next >= 70) fill = PAL.red;
      else if (!this.deadline) fill = PAL.orange;
    }

    const key = text ? `${text}|${fill}` : null;
    if (key === this.shown) return;
    this.shown = key;
    emit(this.host.game, 'timer', { text, color: fill });
  }

  private banner(title: string, line: string): void {
    emit(this.host.game, 'banner', { title, line, holdMs: 2400 });
  }
}
