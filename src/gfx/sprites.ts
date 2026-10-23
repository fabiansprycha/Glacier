import { PAL } from './pixels';

/** Placeholder pixel art. Swap for real spritesheets later, the frame names stay the same. */

/** Survivor in a red hoodie with a company badge on a lanyard. */
export const HERO_COLORS = { k: PAL.black, b: PAL.grey, s: PAL.yellow, c: PAL.red, y: PAL.white, d: PAL.navy };

const HERO_HEAD_DOWN = [
  '................',
  '.....kkkkkk.....',
  '....kbbbbbbk....',
  '...kbbbbbbbbk...',
  '...kbssssssbk...',
  '...kbskssksbk...',
  '...kbssssssbk...',
  '....kksssskk....',
];
const HERO_HEAD_UP = [
  '................',
  '.....kkkkkk.....',
  '....kbbbbbbk....',
  '...kbbbbbbbbk...',
  '...kbbbbbbbbk...',
  '...kbbbbbbbbk...',
  '...kbbbbbbbbk...',
  '....kkbbbbkk....',
];
const HERO_HEAD_SIDE = [
  '................',
  '.....kkkkkk.....',
  '....kbbbbbbk....',
  '...kbbbbbbbbk...',
  '...kbbbsssssk...',
  '...kbbbsssksk...',
  '...kbbbsssssk...',
  '....kkssssskk...',
];
const HERO_BODY = [
  '...kccckkccck...',
  '..ksccyccyccsk..',
  '..kscccyycccsk..',
  '...kcccccccck...',
  '...kddkkkkddk...',
];
const LEGS_IDLE = ['...kddk..kddk...', '...kkkk..kkkk...', '................'];
const LEGS_STEP_A = ['...kddk...kk....', '...kkkk.........', '................'];
const LEGS_STEP_B = ['....kk...kddk...', '.........kkkk...', '................'];

const heads = { down: HERO_HEAD_DOWN, up: HERO_HEAD_UP, side: HERO_HEAD_SIDE };
const legs = [LEGS_IDLE, LEGS_STEP_A, LEGS_STEP_B];

export type HeroFacing = keyof typeof heads;

/** Frames in order: for each facing (down, up, side): idle, step A, step B. */
export const HERO_FRAMES: { name: string; rows: string[] }[] = (Object.keys(heads) as HeroFacing[]).flatMap((facing) =>
  legs.map((leg, i) => ({ name: `${facing}-${i}`, rows: [...heads[facing], ...HERO_BODY, ...leg] })),
);

/** Terminal running an allied software: it sided with the humans. */
export const TERMINAL = {
  colors: { k: PAL.black, s: PAL.silver, g: PAL.teal, l: PAL.lime, d: PAL.navy },
  rows: [
    '................',
    '..kkkkkkkkkkkk..',
    '..kssssssssssk..',
    '..ksggggggggsk..',
    '..ksgglgglggsk..',
    '..ksggggggggsk..',
    '..ksglgggglgsk..',
    '..ksggllllggsk..',
    '..ksggggggggsk..',
    '..kssssssssssk..',
    '..kkkkkkkkkkkk..',
    '......kssk......',
    '....kkkkkkkk....',
    '....kddddddk....',
    '....kkkkkkkk....',
    '................',
  ],
};

/** Glacier: the rogue AI. Placeholder boss body, an ice crystal with a red eye. */
export const GLACIER = {
  colors: { k: PAL.black, w: PAL.white, c: PAL.cyan, b: PAL.sky, n: PAL.blue, r: PAL.red },
  rows: [
    '.......kk.......',
    '......kwck......',
    '.....kwccck.....',
    '....kwcccbck....',
    '...kwccccbbck...',
    '..kwcckkkkbbck..',
    '.kwcckrrrrkbbck.',
    'kwccckrwwrkbbbck',
    'kcccckrrrrkbbbbk',
    '.kccbbkkkkbbbbk.',
    '..kcbbbbbbbbnk..',
    '...kbbbbbbbnk...',
    '....kbbbbbnk....',
    '.....kbbbnk.....',
    '......kbnk......',
    '.......kk.......',
  ],
};

/** Elevator to the next floor, set into the wall of Glacier's server room. */
export const ELEVATOR = {
  colors: { k: PAL.black, g: PAL.grey, s: PAL.silver, w: PAL.white, a: PAL.cyan },
  rows: [
    'kkkkkkkkkkkkkkkk',
    'kggggggaaggggggk',
    'kgggggaaaagggggk',
    'kkkkkkkkkkkkkkkk',
    ...Array.from({ length: 10 }, () => 'kwssssskkssssssk'),
    'kggggggggggggggk',
    'kkkkkkkkkkkkkkkk',
  ],
};

/** Glacier's frost drone, two hover frames (rotors spin). */
const DRONE_BODY = [
  '....kkkkkkkk....',
  '...kbbbbbbbbk...',
  '..kbccccccccbk..',
  '..kbckkrrkkcbk..',
  '..kbccccccccbk..',
  '...kbbbbbbbbk...',
  '....kk....kk....',
  '................',
  '.....w....w.....',
  '................',
];
export const DRONE = {
  colors: { k: PAL.black, b: PAL.blue, c: PAL.cyan, r: PAL.red, w: PAL.white, g: PAL.grey },
  frames: [
    { name: '0', rows: ['................', '.gggkk....kkggg.', '................', ...DRONE_BODY, '................', '................', '................'] },
    { name: '1', rows: ['................', '..kkggg..gggkk..', '................', ...DRONE_BODY, '................', '................', '................'] },
  ],
};

const PEN_ROWS = [
  '................', '................', '................', '................',
  '................', '................', '.kkkkkkkkkkk....', 'kbwbbbbbbbbskk..',
  'kbbbbbbbbbbsssk.', '.kkkkkkkkkkkk...', '................', '................',
  '................', '................', '................', '................',
];

export const PAPER_ROWS = [
  '................', '................', '................', '................',
  '................', '.....kkkkkk.....', '.....kwwwwk.....', '.....kwggwk.....',
  '.....kwwwwk.....', '.....kwggwk.....', '.....kkkkkk.....', '................',
  '................', '................', '................', '................',
];

/** Projectiles and effects, all on 16x16 frames. */
export const FX = {
  colors: { k: PAL.black, y: PAL.yellow, w: PAL.white, c: PAL.cyan, b: PAL.sky, o: PAL.orange, s: PAL.silver, g: PAL.grey, r: PAL.red },
  frames: [
    {
      // Thrown pen, drawn pointing right; rotated to its flight direction.
      name: 'pen',
      rows: PEN_ROWS,
    },
    { name: 'paper', rows: PAPER_ROWS },
    {
      name: 'ice',
      rows: [
        '................', '................', '................', '................',
        '................', '.......w........', '......wcb.......', '.....wccbb......',
        '......cbbk......', '.......bk.......', '................', '................',
        '................', '................', '................', '................',
      ],
    },
    {
      // Company badge on the end of the lanyard, swung for melee.
      name: 'badge',
      rows: [
        '................', '................', '................', '.......kk.......',
        '......k..k......', '....kkkkkkkk....', '....kwwwwwwk....', '....kwyywwwk....',
        '....kwyywggk....', '....kwwwwwwk....', '....kwggggwk....', '....krrrrrrk....',
        '....kkkkkkkk....', '................', '................', '................',
      ],
    },
  ],
};

/** HUD icons. */
export const ICONS = {
  colors: { k: PAL.black, r: PAL.red, o: PAL.orange, g: PAL.grey, s: PAL.slate, y: PAL.yellow, l: PAL.lime, w: PAL.white, x: PAL.silver, b: PAL.blue },
  frames: [
    {
      name: 'heart',
      rows: [
        '................', '................', '...kkk...kkk....', '..korrk.krrrk...',
        '.korwrrkrrrrrk..', '.korrrrrrrrrrk..', '.krrrrrrrrrrrk..', '..krrrrrrrrrk...',
        '...krrrrrrrk....', '....krrrrrk.....', '.....krrrk......', '......krk.......',
        '.......k........', '................', '................', '................',
      ],
    },
    {
      name: 'heart-empty',
      rows: [
        '................', '................', '...kkk...kkk....', '..kssgk.kgssk...',
        '.ksssssksssssk..', '.ksssssssssssk..', '.ksssssssssssk..', '..ksssssssssk...',
        '...ksssssssk....', '....ksssssk.....', '.....ksssk......', '......ksk.......',
        '.......k........', '................', '................', '................',
      ],
    },
    { name: 'pen', rows: PEN_ROWS },
    {
      name: 'coin',
      rows: [
        '................', '................', '................', '.....kkkkkk.....',
        '....kyyyyyyk....', '...kywyyyyyok...', '...kyyooooyok...', '...kyyyyoyyok...',
        '...kyyyoyyyok...', '...kyyoyyyyok...', '...kyyooooyok...', '....koyyyyok....',
        '.....kkkkkk.....', '................', '................', '................',
      ],
    },
  ],
};

/** Mid-level bosses, drawn at 16x16 and scaled up in game. */
export const BOSSES = {
  colors: {
    k: PAL.black, w: PAL.white, s: PAL.silver, g: PAL.grey, r: PAL.red, c: PAL.cyan,
    b: PAL.blue, n: PAL.navy, y: PAL.yellow,
  },
  frames: [
    {
      // Ordinary office printer gone rogue: a regular enemy, drawn at normal size.
      name: 'rogue-printer',
      rows: [
        '................', '................', '....kkkkkkkk....', '....kwwwwwwk....',
        '...kkkkkkkkkk...', '..kssssssssssk..', '..ksggggggggsk..', '..ksgrggggcgsk..',
        '..ksggggggggsk..', '..kssssssssssk..', '..kkkkkkkkkkkk..', '...kwwwwwwwwk...',
        '...kwkkkkkkwk...', '...kwwwwwwwwk...', '...kkkkkkkkkk...', '................',
      ],
    },
    {
      name: 'printer',
      rows: [
        '................', '................', '...kkkkkkkkkk...', '...kwwwwwwwwk...',
        '..kkkkkkkkkkkk..', '.kssssssssssssk.', '.ksggggggggggsk.', '.ksgkkkkkkkkgsk.',
        '.ksggggggggggsk.', '.ksgrgggggcggsk.', '.ksggggggggggsk.', '.kssssssssssssk.',
        '.kkwwwwwwwwwwkk.', '..kwwwwwwwwwwk..', '..kkkkkkkkkkkk..', '................',
      ],
    },
    {
      name: 'guard',
      rows: [
        '................', '.....kkkkkk.....', '....kssssssk....', '....krrrrrrk....',
        '....kssssssk....', '...kkkkkkkkkk...', '..kggsssssssggk.', '..kgsnnnnnnsgk..',
        '..kgsnyyyynsgk..', '..kgsnnnnnnsgk..', '..kkkssssssskkk.', '....ksskkssk....',
        '....ksk..ksk....', '....kkk..kkk....', '................', '................',
      ],
    },
    {
      name: 'mother',
      rows: [
        '................', '.ggkk......kkgg.', '...kk......kk...', '...kkkkkkkkkk...',
        '..kbbbbbbbbbbk..', '.kbccccccccccbk.', '.kbckkrrrrkkcbk.', '.kbccccccccccbk.',
        '.kbbbbbbbbbbbbk.', '..knnkwwwwknnk..', '...kkkwwwwkkk...', '.....kkkkkk.....',
        '................', '................', '................', '................',
      ],
    },
  ],
};


/** Security camera on a wall, drawn looking south (rotated in game). Frames: on, off. */
const CAMERA_ROWS = [
  '.....kkkkkk.....', '.....kggggk.....', '....kkkkkkkk....', '...kssssssssk...',
  '...ksggggggsk...', '...ksgkkkkgsk...', '...ksgkbbkgsk...', '...ksgkbwkgsk...',
  '...ksgkkkkgsk...', '....kssssssk....', '.....kkrrkk.....', '......kkkk......',
  '................', '................', '................', '................',
];
export const CAMERA = {
  colors: { k: PAL.black, g: PAL.grey, s: PAL.silver, b: PAL.sky, w: PAL.white, r: PAL.red, d: PAL.slate },
  frames: [
    { name: 'on', rows: CAMERA_ROWS },
    { name: 'off', rows: CAMERA_ROWS.map((r) => r.replace(/[rbw]/g, 'd')) },
  ],
};
