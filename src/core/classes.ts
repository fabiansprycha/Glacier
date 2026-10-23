import type { PlayerStats } from './stats';

export type HeroClass = 'dev' | 'qa' | 'scrum' | 'analyst';

export interface ClassDef {
  name: string;
  /** One line of flavour for the class picker. */
  tagline: string;
  /** What the class does differently, shown on the picker. */
  perks: string[];
  /** Applied once to fresh stats at the start of a run. */
  start: (stats: PlayerStats) => void;
}

/** Office roles the survivor can play. Perks are read with `isClass` where they apply. */
export const CLASSES: Record<HeroClass, ClassDef> = {
  dev: {
    name: 'Developer',
    tagline: 'Wrote half the code Glacier runs on.',
    perks: ['Pens deal +1 damage', 'Starts with 15 pens', 'Bot test is 1 key shorter'],
    start: (s) => {
      s.rangedDamage += 1;
      s.pens = 15;
    },
  },
  qa: {
    name: 'QA Tester',
    tagline: 'Finds the bug before it finds you.',
    perks: ['+1 max HP', 'Spots buggy computers up close: Glacier traps and CCTV'],
    start: (s) => {
      s.maxHp += 1;
      s.hp += 1;
    },
  },
  scrum: {
    name: 'Scrum Master',
    tagline: 'Survived a thousand stand-ups.',
    perks: ['+2 max HP', 'Badge deals +1 damage'],
    start: (s) => {
      s.maxHp += 2;
      s.hp += 2;
      s.meleeDamage += 1;
    },
  },
  analyst: {
    name: 'Analyst',
    tagline: 'Knows where the budget went.',
    perks: ['Starts with 6 PLN', '+1 PLN from every cash find', 'Vending machines 25% cheaper'],
    start: (s) => {
      s.pln += 6;
    },
  },
};

export const CLASS_IDS = Object.keys(CLASSES) as HeroClass[];

export function isClass(stats: Pick<PlayerStats, 'heroClass'>, cls: HeroClass): boolean {
  return stats.heroClass === cls;
}
