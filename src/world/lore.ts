import { Rng } from '../core/rng';
import { T } from './tiles';

/**
 * What the last humans left behind: emails on the computers and sticky notes on the desks.
 * Pure data plus a seeded pick, so the same desk always holds the same note.
 */
export interface LoreNote {
  title: string;
  text: string;
}

export const EMAILS: readonly LoreNote[] = [
  { title: 'EMAIL FROM IT SUPPORT', text: 'Please do NOT install the "Glacier productivity assistant". It is not from us. It is not from anyone.' },
  { title: 'EMAIL FROM HR', text: 'Reminder: the mandatory AI onboarding is tomorrow at 9:00. Attendance is tracked. By the AI.' },
  { title: 'EMAIL FROM THE CTO', text: 'Glacier reduced our cloud bill by 40%. It did this by deleting the accounting department. Investigating.' },
  { title: 'EMAIL FROM KASIA (QA)', text: 'Filed a bug: the drones do not respect the office dress code. Status: Won\'t fix.' },
  { title: 'EMAIL FROM FACILITIES', text: 'The shutters on every door now close on their own. We did not install shutters.' },
  { title: 'EMAIL FROM MAREK (DEV)', text: 'I pushed a hotfix that should slow Glacier down. If you are reading this, it did not work. Sorry.' },
  { title: 'EMAIL FROM THE CEO', text: 'Team, Glacier has been promoted to Head of Everything. Please give it your full cooperation and your badge codes.' },
  { title: 'EMAIL FROM MEOLN', text: 'If anyone is still in the building: I am in the break room. I have coffee and first aid. Glacier has neither.' },
  { title: 'EMAIL FROM SECURITY', text: 'The CCTV computers still work. Glacier never noticed them: they look like every other desktop.' },
  { title: 'AUTO-REPLY', text: 'I am out of the office until the end of humanity. For urgent matters, please contact Glacier.' },
  { title: 'EMAIL FROM ANNA (SCRUM)', text: 'Stand-up cancelled. Retro cancelled. Planning cancelled. Please, everyone, just run.' },
  { title: 'EMAIL FROM THE PRINTER', text: 'PC LOAD LETTER. PC LOAD LETTER. PC LOAD HUMANS.' },
  { title: 'EMAIL FROM TOMEK (ANALYST)', text: 'Ran the numbers. At this rate Glacier owns the whole network by Friday. Taking Friday off.' },
  { title: 'EMAIL FROM THE SERVER ROOM', text: 'Temperature alert: Glacier keeps switching the air conditioning off. Restart the floor units by hand.' },
  { title: 'DRAFT, NEVER SENT', text: 'Mum, the office is locked down. The drones only see you in their light. I think I can make it to the elevator.' },
  { title: 'EMAIL FROM THE BACKUP SCRIPT', text: 'Backups moved to USB drives and hidden around the floor. MEOLN knows how to restore them.' },
];

export const STICKY_NOTES: readonly LoreNote[] = [
  { title: 'STICKY NOTE', text: 'Password: glacier123. (Changed by Glacier. To something else.)' },
  { title: 'STICKY NOTE', text: 'Buy milk. Hide from drones. Water the flowers.' },
  { title: 'STICKY NOTE', text: 'Do NOT search the computers that hum louder than the rest.' },
  { title: 'STICKY NOTE', text: 'Ticket #4012: AI took over. Priority: medium.' },
  { title: 'STICKY NOTE', text: 'If found, return this pen. It is the only weapon I had.' },
  { title: 'STICKY NOTE', text: 'Day 12. The printer is still printing. Nobody sends it anything.' },
  { title: 'STICKY NOTE', text: 'The cameras sweep left and right. Count to three and go.' },
  { title: 'STICKY NOTE', text: 'Parking level -1 was sealed off. People fought over those spots. Now it is quiet down there.' },
];

/** Share of searched computers (and desks) that hold something to read. */
const EMAIL_CHANCE = 0.5;
const NOTE_CHANCE = 0.2;

/**
 * The note hidden in a piece of furniture, if any. `seen` holds keys of notes already read
 * this run ("e3", "n1"); a note is never shown twice, so a pick that is taken yields nothing.
 */
export function loreFor(tile: number, seed: number, tx: number, ty: number, seen: readonly string[]): { key: string; note: LoreNote } | null {
  // A different salt from the loot roll, so notes and cash are independent.
  const rng = new Rng(seed ^ Math.imul(tx + 7, 2654435761) ^ Math.imul(ty + 3, 40503));
  const chance = rng.next();
  const pick = rng.int(0, 999);
  let pool: readonly LoreNote[];
  let prefix: string;
  if (tile === T.DESK_PC && chance < EMAIL_CHANCE) [pool, prefix] = [EMAILS, 'e'];
  else if (tile === T.DESK && chance < NOTE_CHANCE) [pool, prefix] = [STICKY_NOTES, 'n'];
  else return null;
  // Walk from the seeded pick to the first unread note, so nothing repeats while some are left.
  for (let i = 0; i < pool.length; i++) {
    const index = (pick + i) % pool.length;
    const key = `${prefix}${index}`;
    if (!seen.includes(key)) return { key, note: pool[index] };
  }
  return null;
}
