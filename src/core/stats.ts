import type { ItemId } from './items';

/** Everything about the player that carries over between floors. */
export interface PlayerStats {
  hp: number;
  maxHp: number;
  /** Pens to throw: one per throw, picked up from desks. */
  pens: number;
  maxPens: number;
  /** PLN: currency for vending machines. */
  pln: number;
  meleeDamage: number;
  rangedDamage: number;
  /** Ids of owned items (see core/items.ts). */
  items: ItemId[];
}

export function newPlayerStats(): PlayerStats {
  return { hp: 6, maxHp: 6, pens: 10, maxPens: 30, pln: 0, meleeDamage: 2, rangedDamage: 1, items: [] };
}
