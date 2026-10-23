import { describe, expect, it } from 'vitest';
import { newPlayerStats } from '../src/core/stats';
import { rollLoot } from '../src/world/loot';
import { ITEM_IDS, grantItem, unownedItems } from '../src/core/items';
import { T } from '../src/world/tiles';

describe('rollLoot', () => {
  it('is deterministic per seed and tile', () => {
    expect(rollLoot(T.CABINET, 7, 3, 4)?.id).toBe(rollLoot(T.CABINET, 7, 3, 4)?.id);
  });

  it('gives nothing for furniture that cannot be searched', () => {
    expect(rollLoot(T.PLANT, 1, 1, 1)).toBeNull();
  });

  it('respects caps and finds a mix of items', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      for (const tile of [T.CABINET, T.DESK_PC, T.DESK, T.DESK_PC_GLACIER]) {
        const stats = newPlayerStats();
        const loot = rollLoot(tile, i, i % 15, i % 11);
        if (!loot) continue;
        ids.add(loot.id);
        loot.apply(stats);
        expect(stats.hp).toBeLessThanOrEqual(stats.maxHp);
        expect(stats.pens).toBeLessThanOrEqual(stats.maxPens);
      }
    }
    expect([...ids].sort()).toEqual(['item', 'medkit', 'pens', 'pln']);
  });
});

describe('items', () => {
  it('are granted once and never offered again', () => {
    const stats = newPlayerStats();
    for (let i = 0; i < 40; i++) {
      const [id] = unownedItems(stats, i);
      if (!id) break;
      grantItem(stats, id);
    }
    expect(new Set(stats.items).size).toBe(stats.items.length);
    expect(stats.items.sort()).toEqual([...ITEM_IDS].sort());
    expect(unownedItems(stats, 1)).toEqual([]);
    expect(stats.maxHp).toBe(8);
    expect(stats.meleeDamage).toBe(3);
  });
});
