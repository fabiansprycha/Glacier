import type { PlayerStats } from '../core/stats';
import { grantItem, unownedItems } from '../core/items';
import { isClass } from '../core/classes';
import { Rng } from '../core/rng';
import { T } from './tiles';

/** Something found while searching. `apply` mutates the stats and returns the message for the HUD. */
export interface Loot {
  id: string;
  apply: (stats: PlayerStats) => string;
}

const heal = (n: number): Loot => ({
  id: 'medkit',
  apply: (s) => {
    s.hp = Math.min(s.maxHp, s.hp + n);
    return `First aid kit: +${n} HP`;
  },
});
const pens = (n: number): Loot => ({
  id: 'pens',
  apply: (s) => {
    s.pens = Math.min(s.maxPens, s.pens + n);
    return `Pens: +${n}`;
  },
});
const pln = (n: number): Loot => ({
  id: 'pln',
  apply: (s) => {
    // Analysts always find a little extra.
    const found = n + (isClass(s, 'analyst') ? 1 : 0);
    s.pln += found;
    return `Cash: +${found} PLN`;
  },
});
/** A random item the player does not own yet (pln if they own everything). */
const item = (rng: Rng): Loot => {
  const seed = rng.int(0, 0xffffff);
  return {
    id: 'item',
    apply: (s) => {
      const [id] = unownedItems(s, seed);
      return id ? grantItem(s, id) : pln(5).apply(s);
    },
  };
};

type Table = { weight: number; roll: (rng: Rng) => Loot | null }[];

const CABINET_TABLE: Table = [
  { weight: 30, roll: () => null },
  { weight: 25, roll: (rng) => pln(rng.int(1, 3)) },
  { weight: 20, roll: () => heal(1) },
  { weight: 15, roll: (rng) => pens(rng.int(1, 3)) },
  { weight: 10, roll: item },
];

const PC_TABLE: Table = [
  { weight: 25, roll: () => null },
  { weight: 20, roll: (rng) => pens(rng.int(1, 3)) },
  { weight: 40, roll: (rng) => pln(rng.int(1, 3)) },
  { weight: 10, roll: () => heal(1) },
  { weight: 5, roll: item },
];

/** Desks are where the pens are. */
const DESK_TABLE: Table = [
  { weight: 25, roll: () => null },
  { weight: 65, roll: (rng) => pens(rng.int(2, 4)) },
  { weight: 7, roll: () => pln(1) },
  { weight: 3, roll: item },
];

/** Glacier's computers, after passing its "prove you're a bot" check: never empty, often an upgrade. */
const GLACIER_PC_TABLE: Table = [
  { weight: 35, roll: (rng) => pens(rng.int(4, 6)) },
  { weight: 30, roll: (rng) => pln(rng.int(3, 5)) },
  { weight: 10, roll: () => heal(2) },
  { weight: 25, roll: item },
];

/** Smashed clutter: usually nothing, sometimes a coin or a pen rolls out. */
const CLUTTER_TABLE: Table = [
  { weight: 75, roll: () => null },
  { weight: 15, roll: () => pln(1) },
  { weight: 10, roll: () => pens(1) },
];

/** Moving boxes hold a bit more. */
const BOXES_TABLE: Table = [
  { weight: 55, roll: () => null },
  { weight: 25, roll: (rng) => pln(rng.int(1, 2)) },
  { weight: 20, roll: (rng) => pens(rng.int(1, 2)) },
];

const TABLES: Partial<Record<number, Table>> = {
  [T.BOXES]: BOXES_TABLE,
  [T.CHAIR]: CLUTTER_TABLE,
  [T.FLOWERS]: CLUTTER_TABLE,
  [T.CABINET]: CABINET_TABLE,
  [T.DESK_PC]: PC_TABLE,
  [T.DESK]: DESK_TABLE,
  [T.DESK_PC_GLACIER]: GLACIER_PC_TABLE,
};

/** Rolls the loot hidden in one piece of furniture. Deterministic per floor seed and tile position. */
export function rollLoot(tile: number, seed: number, tx: number, ty: number): Loot | null {
  const table = TABLES[tile];
  if (!table) return null;
  const rng = new Rng(seed ^ Math.imul(tx + 1, 73856093) ^ Math.imul(ty + 1, 19349663));
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  let pick = rng.next() * total;
  for (const entry of table) {
    pick -= entry.weight;
    if (pick < 0) return entry.roll(rng);
  }
  return null;
}
