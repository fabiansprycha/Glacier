import { Rng } from './rng';
import type { PlayerStats } from './stats';

/**
 * Passive items. Each is owned at most once. Stat items change numbers in `apply`;
 * effect items change how the game plays and are checked with `hasItem` where it matters.
 */
export interface ItemDef {
  name: string;
  /** One line for the shop and the pickup message. */
  desc: string;
  /** Price in pln at a vending machine. */
  price: number;
  apply?: (stats: PlayerStats) => void;
}

export const ITEMS = {
  lanyard: { name: 'Steel lanyard', desc: '+1 badge damage', price: 7, apply: (s) => (s.meleeDamage += 1) },
  fountainPen: { name: 'Fountain pen', desc: '+1 pen damage', price: 7, apply: (s) => (s.rangedDamage += 1) },
  coffee: {
    name: 'Coffee thermos',
    desc: '+2 max HP',
    price: 8,
    apply: (s) => {
      s.maxHp += 2;
      s.hp += 2;
    },
  },
  espresso: { name: 'Double espresso', desc: 'Move faster', price: 6 },
  fourColorPen: { name: 'Four-colour pen', desc: '3 pens per throw, costs 1', price: 14 },
  gelPen: { name: 'Gel pen', desc: 'Pens fly through enemies', price: 10 },
  stapler: { name: 'Stapler', desc: 'Throw twice as fast', price: 13 },
  penPocket: { name: 'Pen pocket', desc: '1 in 3 throws costs no pen', price: 8 },
  bungee: { name: 'Bungee lanyard', desc: 'Longer badge reach', price: 8 },
  vipBadge: { name: 'VIP badge', desc: 'Badge swings destroy enemy shots', price: 11 },
  wristband: { name: 'Antistatic wristband', desc: 'Electric traps do not hurt', price: 7 },
  hoodie: { name: 'Hoodie', desc: 'Cameras only spot you up close', price: 6 },
  mug: { name: 'Company mug', desc: '+1 HP for each cleared room', price: 9 },
  headphones: { name: 'ANC headphones', desc: 'More time in the bot test', price: 6 },
} satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

export function hasItem(stats: PlayerStats, id: ItemId): boolean {
  return stats.items.includes(id);
}

/** Gives the item and returns the message for the HUD. */
export function grantItem(stats: PlayerStats, id: ItemId): string {
  const item: ItemDef = ITEMS[id];
  if (!hasItem(stats, id)) {
    stats.items.push(id);
    item.apply?.(stats);
  }
  return `${item.name}: ${item.desc}`;
}

/** Items the player does not own yet, in a seeded random order. */
export function unownedItems(stats: PlayerStats, seed: number): ItemId[] {
  return new Rng(seed).shuffle(ITEM_IDS.filter((id) => !hasItem(stats, id)));
}
