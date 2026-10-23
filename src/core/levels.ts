/** Which boss guards a level's elevator. Glacier is only met on the last level. */
export type BossKind = 'printer' | 'guard' | 'mother' | 'glacier';

export interface LevelDef {
  name: string;
  /** Story line shown when the level starts. */
  intro: string;
  roomCount: number;
  boss: BossKind;
  /** Max enemies per ordinary room. */
  maxDrones: number;
  /** Share of those enemies that are rogue printers instead of drones. */
  printerChance: number;
  /** Electrified floor traps per ordinary room, inclusive range. */
  traps: [number, number];
  /** Share of ordinary rooms with no drones, watched by a security camera instead. */
  cameraChance: number;
  /** Share of computers that run Glacier's verification (the "prove you're a bot" minigame). */
  glacierPcChance: number;
  /** Minigame: how many keys to type and how long the player gets. */
  captchaLength: number;
  captchaMs: number;
  /** A hidden room behind a cracked wall, with waves of enemies and a reward. */
  secretRoom?: boolean;
}

/** The whole campaign, bottom floor first. Add levels here; the game ends after the last one. */
export const LEVELS: readonly LevelDef[] = [
  {
    name: 'Open space',
    intro: 'Glacier took over the network. People fled the offices. The printer at the end of the floor is still printing.',
    roomCount: 8,
    boss: 'printer',
    maxDrones: 2,
    printerChance: 0.3,
    traps: [0, 1],
    cameraChance: 0.3,
    glacierPcChance: 0.25,
    captchaLength: 4,
    captchaMs: 3200,
    secretRoom: true,
  },
  {
    name: 'IT department',
    intro: 'The software that sides with humans was written here. Security only obeys Glacier now.',
    roomCount: 10,
    boss: 'guard',
    maxDrones: 3,
    printerChance: 0.35,
    traps: [0, 2],
    cameraChance: 0.35,
    glacierPcChance: 0.3,
    captchaLength: 5,
    captchaMs: 3200,
  },
  {
    name: 'Data centre',
    intro: 'The roar of the fans drowns out everything. Somewhere in here, drones are being born.',
    roomCount: 12,
    boss: 'mother',
    maxDrones: 4,
    printerChance: 0.4,
    traps: [1, 2],
    cameraChance: 0.4,
    glacierPcChance: 0.35,
    captchaLength: 6,
    captchaMs: 3400,
  },
  {
    name: "Glacier's core",
    intro: 'Ice has sealed the top floor. Glacier waits in the server room.',
    roomCount: 14,
    boss: 'glacier',
    maxDrones: 5,
    printerChance: 0.4,
    traps: [1, 3],
    cameraChance: 0.45,
    glacierPcChance: 0.4,
    captchaLength: 7,
    captchaMs: 3600,
  },
];

export function levelDef(level: number): LevelDef {
  return LEVELS[Math.min(level, LEVELS.length) - 1];
}

export const BOSS_NAMES: Record<BossKind, string> = {
  printer: 'NETWORK PRINTER',
  guard: 'SECURITY BOT',
  mother: 'SWARM MOTHER',
  glacier: 'GLACIER',
};
