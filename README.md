# Glacier: Abandoned Offices (prototype)

A top-down 2D pixel-art roguelike with procedurally generated rooms. Runs in the browser.

**Play it:** https://fabiansprycha.github.io/Glacier/ (deployed by GitHub Actions on every push to `main`).

## The world

An AI has taken over the world. A piece of software called **Glacier** destroys people and hunts down other software that sided with humans. The player makes their way through abandoned IT offices: open spaces, meeting rooms, archives, break rooms and server rooms frozen over by Glacier. Each floor of the office building is one level, and the elevator in the boss room leads up.

## Running it

```bash
npm install
npm run dev          # dev server with hot reload
npm test             # generator tests (vitest)
npm run build        # production build in dist/
npm run build:single # a single file, dist-single/index.html (easy to share or host anywhere)
```

Controls: WSAD (or arrow keys) to move, J to swing the badge on its lanyard, K to throw a pen, Space to search desks, cabinets and computers, I (or Tab) for the inventory, Esc (or P) to pause. The game opens on a title screen (New game, How to play); the pause menu has Resume, Restart run and Main menu. URL parameters: `?seed=42` replays a layout, `?level=3` starts on a given level (both skip the title screen).

## Stack

- **TypeScript**: in a game that will keep growing (stats, items, bosses), types save a lot of bugs.
- **Phaser 4**: a mature 2D browser engine with a camera, tilemaps, arcade physics, animation, input and sound.
- **Vite**: fast dev server and builds. **Vitest**: logic tests without a browser.

## Architecture

```
src/
  core/      config, seeded RNG, controls, levels, items, typed events between scenes
  world/     pure world logic with no Phaser: dungeon generator, room layouts, tiles, loot
  gfx/       placeholder art drawn in code (Sweetie 16 palette)
  entities/  player, drones, rogue printers, bosses (printer, security bot, swarm mother, Glacier)
  systems/   combat, searching furniture, breakables, traps, security cameras
  scenes/    Boot (textures) → Menu (title screen) → Game (gameplay) + UI (HUD, minimap), with
             Captcha (minigame), Shop (vending machine), Inventory and Pause as overlays
tests/       generator and loot tests over hundreds of seeds
```

Principles that keep it easy to extend:

1. **The generator is a pure function of the seed** (`world/dungeon.ts`). The same seed always gives the same floor, so it can be tested, debugged and shared.
2. **A floor is a tree of rooms on a grid** (like The Binding of Isaac). The farthest dead end is the boss room, another dead end is the break room. New room types are added in the same place; the secret room hangs off the tree behind a cracked wall.
3. **Room layouts are patterns plus validation** (`world/roomLayout.ts`). A new furniture pattern is one more entry in a list; a flood fill makes sure no room has a cut-off door (breakable clutter may block a path, since it can always be smashed).
4. **Scenes talk through events** (`core/events.ts`), so the HUD, sound or achievements can listen in without touching gameplay code.
5. **Art is swappable**: sprites have named frames (`down-0`, `side-2`...). When a real spritesheet arrives, only `gfx/` changes.

## What the prototype has

- **4 levels** (`core/levels.ts`): Open space → IT department → Data centre → Glacier's core. Each has its own room count, enemies, traps and minigame difficulty. A new level is one more entry in `LEVELS`.
- **Bosses**: the Network printer (fans and rings of paper), the Security bot (telegraphs a charge and rams into the wall), the Swarm mother (keeps its distance and launches drones) and finally **Glacier** (ice shards, calls drones in its last third of health). Beating Glacier wins the run.
- **Boss balance**: bosses have 45 / 60 / 70 health (Glacier 110) and take at most one pen every 0.22 s, so a fan of pens from the four-colour pen does not melt them in a second.
- **Combat**: the badge on a lanyard (an arc swing with knockback) and thrown pens (one pen per throw, pens are ammo). Drones and shots fly over furniture.
- **Enemies**: drones that chase you, and rogue printers (30–40% of room enemies) that stand still and shoot a sheet of paper at you every 2 seconds. Entering a room with enemies shuts its doors with shutters until they are gone.
- **Traps**: floor plates with a torn cable. Cycle: idle, sparks (warning), current (damage).
- **Security cameras** in some rooms without enemies: they sweep and show a yellow vision cone. Stepping into it raises the alarm, the doors shut and drones fly in (more on higher levels). The camera keeps watching after an alarm (its cone turns red) and can call more drones 5 seconds later. The only way to stop it is the room's CCTV computer. It looks like every other computer, so you have to find it by searching, but it always stands somewhere the camera can never see. Cameras keep sweeping while you search.
- **Searching** (Space) desks (mostly pens), cabinets (first aid, cash) and computers (cash). Only once the room has no enemies.
- **Glacier's computers** look exactly like ordinary ones, so you never know which one is a trap. Searching one starts the "Prove you are a bot" minigame: type the WSAD sequence before time runs out. Passing gives rich loot; failing or running out of time raises the alarm and extra drones fly in.
- **Breakable obstacles**: boxes (3 hits), chairs and dried plants (2), potted flowers (1). Smash them with the badge or pens; sometimes a coin or a pen drops out. Sometimes a barricade blocks the way in front of a door.
- **Secret underground car park** (level 1): behind a cracked wall in one of the rooms. Smash the wall, walk in, survive 3 waves of enemies; the reward is 10 PLN and an item.
- **Inventory** (I / Tab): stats and the list of items with descriptions. The HUD only shows a counter, so nothing covers the game.
- **Vending machines** (2 per level): each sells one snack (protein bar +2 HP or a pack of pens) and two items you do not own yet. You pay in PLN: 1 per drone, 6 per boss, the rest from searching.
- **Items with effects** (`core/items.ts`): four-colour pen (3 pens per throw), gel pen (pierces enemies), stapler (faster throws), pen pocket, bungee lanyard (longer swing), VIP badge (swings destroy shots), antistatic wristband (trap immunity), hoodie (cameras only see you up close), company mug (+1 HP per cleared room), ANC headphones (more time in the minigame), double espresso (faster movement), plus stat items: steel lanyard, fountain pen, coffee thermos. Each item can be owned once. Sources: vending machines, loot, Glacier's computers, the ARGUS terminal, bosses and the secret room.
- **ARGUS terminal** (allied software) in the break room: full repair, pens up to 10, one item.
- Health, pens, cash and items carry over between levels. Dying (or beating Glacier) returns to the title screen.

## Next steps (suggested order)

1. More enemy types (e.g. shooting cameras) and drops from defeated enemies. More kinds of traps.
2. Active items with a cooldown (e.g. a drone jammer), synergies between items.
3. More Glacier phases (e.g. freezing the floor), other hacking minigames.
4. Progression: character levels / an upgrade tree between runs, saved in localStorage.
5. Real art and sound.
