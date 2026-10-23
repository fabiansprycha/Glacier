import { describe, expect, it } from 'vitest';
import { GRID, ROOM_H, ROOM_W } from '../src/core/config';
import { LEVELS } from '../src/core/levels';
import { DIRS, DIR_VEC, OPPOSITE, findRoomAt, generateDungeon } from '../src/world/dungeon';
import { DOOR_POS, isFullyConnected } from '../src/world/roomLayout';
import { cameraCanSeeTile } from '../src/world/cameraVision';
import { BOSSES, CAMERA, DRONE, ELEVATOR, FX, GLACIER, HERO_FRAMES, ICONS, TERMINAL } from '../src/gfx/sprites';
import { isBreakable, isWalkable } from '../src/world/tiles';
import { T } from '../src/world/tiles';

const seeds = Array.from({ length: 300 }, (_, i) => i * 7919 + 1);

describe('generateDungeon', () => {
  it('is deterministic for a seed', () => {
    const a = generateDungeon({ seed: 42, level: LEVELS[1] });
    const b = generateDungeon({ seed: 42, level: LEVELS[1] });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it.each(LEVELS.map((level, i) => [i + 1, level] as const))('produces valid floors for level %i', (_n, level) => {
    const roomCount = level.roomCount;
    let cameras = 0;
    for (const seed of seeds) {
      const d = generateDungeon({ seed, level });
      // The secret room hangs off the door tree; it is checked on its own below.
      const tree = d.rooms.filter((r) => r.type !== 'secret');
      expect(tree).toHaveLength(roomCount);
      expect(d.rooms).toHaveLength(roomCount + (level.secretRoom ? 1 : 0));

      const positions = new Set(d.rooms.map((r) => `${r.gx},${r.gy}`));
      expect(positions.size).toBe(d.rooms.length);
      for (const r of d.rooms) {
        expect(r.gx).toBeGreaterThanOrEqual(0);
        expect(r.gx).toBeLessThan(GRID);
        expect(r.gy).toBeGreaterThanOrEqual(0);
        expect(r.gy).toBeLessThan(GRID);
      }

      expect(d.rooms.filter((r) => r.type === 'start')).toEqual([d.start]);
      expect(d.rooms.filter((r) => r.type === 'boss')).toEqual([d.boss]);
      expect(d.rooms.filter((r) => r.type === 'treasure')).toEqual([d.treasure]);
      expect(d.boss.depth).toBe(Math.max(...tree.filter((r) => r.type !== 'start').map((r) => r.depth)));

      // Doors are symmetric and lead to an existing room.
      for (const r of d.rooms) {
        for (const dir of DIRS) {
          if (!r.doors[dir]) continue;
          const n = findRoomAt(d, r.gx + DIR_VEC[dir].x, r.gy + DIR_VEC[dir].y);
          expect(n).toBeDefined();
          // The way into the secret room is a cracked wall until the player smashes it.
          if (r === d.secret) expect(n!.secretDoor).toBe(OPPOSITE[dir]);
          else expect(n!.doors[OPPOSITE[dir]]).toBe(true);
        }
      }

      // Every room is reachable from the start through doors.
      const seen = new Set([d.start.id]);
      const stack = [d.start];
      while (stack.length) {
        const r = stack.pop()!;
        for (const dir of DIRS) {
          if (!r.doors[dir]) continue;
          const n = findRoomAt(d, r.gx + DIR_VEC[dir].x, r.gy + DIR_VEC[dir].y)!;
          if (!seen.has(n.id)) {
            seen.add(n.id);
            stack.push(n);
          }
        }
      }
      expect(seen.size).toBe(roomCount);
      expect(d.rooms.filter((r) => r.vending).length).toBe(2);
      for (const r of d.rooms) if (r.vending) expect(r.tiles[r.vending.y][r.vending.x]).toBe(T.VENDING);

      // Room interiors: right size, doors open, nothing walled off.
      for (const r of d.rooms) {
        expect(r.tiles).toHaveLength(ROOM_H);
        r.tiles.forEach((row) => expect(row).toHaveLength(ROOM_W));
        for (const dir of DIRS) {
          const p = DOOR_POS[dir];
          expect(r.tiles[p.y][p.x] === T.DOOR).toBe(r.doors[dir]);
        }
        // Clutter may block paths, but it can always be smashed.
        expect(isFullyConnected(r.tiles, true)).toBe(true);
        if (r.type !== 'normal') expect(r.enemies).toEqual([]);
        for (const e of r.enemies) expect(isWalkable(r.tiles[e.y][e.x])).toBe(true);
        expect(r.traps.length).toBeLessThanOrEqual(level.traps[1]);
        if (r.camera) {
          expect(r.type).toBe('normal');
          expect(r.enemies).toEqual([]);
          expect(r.tiles[r.camera.y][r.camera.x]).not.toBe(T.DOOR);
          expect(isWalkable(r.tiles[r.camera.y][r.camera.x])).toBe(false);
          // Its CCTV computer is always somewhere the camera can never look.
          const pc = r.cameraPc!;
          expect(r.tiles[pc.y][pc.x]).toBe(T.CAMERA_PC);
          expect(cameraCanSeeTile(r.camera, pc.x, pc.y)).toBe(false);
          cameras++;
        } else {
          expect(r.cameraPc).toBeNull();
        }
        for (const t of r.traps) {
          expect(isWalkable(r.tiles[t.y][t.x])).toBe(true);
          expect(r.enemies.some((e) => e.x === t.x && e.y === t.y)).toBe(false);
        }
      }
    }
    expect(cameras).toBeGreaterThan(seeds.length / 2);
  });
});

describe('enemies', () => {
  it('mix rogue printers in with drones', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 30; seed++)
      for (const r of generateDungeon({ seed, level: LEVELS[0] }).rooms) r.enemies.forEach((e) => kinds.add(e.kind));
    expect([...kinds].sort()).toEqual(['drone', 'printer']);
  });
});

describe('secret room', () => {
  it('is an underground car park behind a cracked wall, on level 1 only', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const d = generateDungeon({ seed, level: LEVELS[0] });
      const secret = d.secret!;
      expect(secret.type).toBe('secret');
      expect(DIRS.filter((dir) => secret.doors[dir])).toHaveLength(1);
      const host = d.rooms.find((r) => r.secretDoor)!;
      expect(host.type).toBe('normal');
      const p = DOOR_POS[host.secretDoor!];
      expect(host.tiles[p.y][p.x]).toBe(T.WALL_CRACKED);
      expect(secret.tiles.flat()).toContain(T.WALL_SIGN);
      expect(isFullyConnected(secret.tiles)).toBe(true);
    }
    expect(generateDungeon({ seed: 1, level: LEVELS[1] }).secret).toBeNull();
  });
});

describe('espresso machines', () => {
  it('are rare and stand in ordinary rooms', () => {
    let rooms = 0;
    let machines = 0;
    for (let seed = 1; seed <= 200; seed++) {
      for (const r of generateDungeon({ seed, level: LEVELS[2] }).rooms) {
        if (r.type === 'normal') rooms++;
        if (!r.coffee) continue;
        machines++;
        expect(r.type).toBe('normal');
        expect(r.tiles[r.coffee.y][r.coffee.x]).toBe(T.COFFEE_MACHINE);
        expect(isFullyConnected(r.tiles, true)).toBe(true);
      }
    }
    expect(machines).toBeGreaterThan(0);
    expect(machines / rooms).toBeLessThan(0.1);
  });
});

describe('clutter', () => {
  it('fills rooms with breakable obstacles, the start room included, never on a door', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const d = generateDungeon({ seed, level: LEVELS[0] });
      const count = (r: (typeof d.rooms)[number]) => r.tiles.flat().filter((t) => isBreakable(t)).length;
      expect(count(d.start)).toBeGreaterThanOrEqual(6); // 4 plants + junk
      const normal = d.rooms.filter((r) => r.type === 'normal');
      expect(normal.reduce((n, r) => n + count(r), 0) / normal.length).toBeGreaterThan(3);
      for (const r of d.rooms)
        for (const dir of DIRS) {
          const p = DOOR_POS[dir];
          const inside = { x: p.x - DIR_VEC[dir].x, y: p.y - DIR_VEC[dir].y };
          expect(isBreakable(r.tiles[inside.y][inside.x])).toBe(false);
        }
    }
  });
});

describe('sprites', () => {
  it('are all 16x16', () => {
    for (const rows of [...HERO_FRAMES.map((f) => f.rows), TERMINAL.rows, GLACIER.rows, ELEVATOR.rows, ...[DRONE, FX, ICONS, BOSSES, CAMERA].flatMap((s) => s.frames.map((f) => f.rows))]) {
      expect(rows).toHaveLength(16);
      rows.forEach((row) => expect(row).toHaveLength(16));
    }
  });
});
