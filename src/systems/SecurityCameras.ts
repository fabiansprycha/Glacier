import Phaser from 'phaser';
import { ROOM_H, ROOM_W, TILE } from '../core/config';
import type { Player } from '../entities/Player';
import { PAL } from '../gfx/pixels';
import { TEX } from '../gfx/textures';
import { CAMERA_HALF_FOV, CAMERA_NUDGE, CAMERA_RANGE, CAMERA_SWEEP } from '../world/cameraVision';
import type { Room } from '../world/dungeon';

const RANGE = CAMERA_RANGE;
const HALF_FOV = CAMERA_HALF_FOV;
const SWEEP = CAMERA_SWEEP;
const SWEEP_MS = 3800;
/** After an alarm the camera keeps sweeping, but waits this long before it can call drones again. */
const REARM_MS = 5000;
/** After entering a room the player gets a moment before cameras can see them. */
const GRACE_MS = 600;

const color = (hex: string) => Phaser.Display.Color.HexStringToColor(hex).color;

interface Camera {
  room: Room;
  sprite: Phaser.GameObjects.Image;
  cone: Phaser.GameObjects.Graphics;
  facing: number;
  phase: number;
  /** Shut down from its CCTV computer: the only way to stop it. */
  disabled: boolean;
  /** No new alarm before this time (right after one went off). */
  rearmAt: number;
}

/**
 * Wall-mounted cameras that sweep their room. A player inside the cone trips the alarm; the camera
 * keeps watching and can call drones again after a pause. Only its CCTV computer shuts it down. Furniture does not block the view: they look down from the ceiling.
 */
export class SecurityCameras {
  private cameras: Camera[] = [];
  private activeSince = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Player,
    private readonly onSpotted: (room: Room) => void,
    /** Multiplier on the view distance (the hoodie item shortens it). */
    private readonly rangeScale: () => number = () => 1,
  ) {}

  add(room: Room, tx: number, ty: number, facing: number): void {
    // Nudge the sprite off the wall tile towards the room, so it looks mounted on the wall.
    const x = (room.gx * ROOM_W + tx) * TILE + TILE / 2 + Math.cos(facing) * CAMERA_NUDGE;
    const y = (room.gy * ROOM_H + ty) * TILE + TILE / 2 + Math.sin(facing) * CAMERA_NUDGE;
    const sprite = this.scene.add.image(x, y, TEX.camera, 'on').setRotation(facing - Math.PI / 2).setDepth(9000);
    const cone = this.scene.add.graphics().setDepth(-990);
    this.cameras.push({ room, sprite, cone, facing, phase: (tx * 31 + ty * 17) % 10, disabled: false, rearmAt: 0 });
  }

  /** The CCTV computer was used: the room's camera goes dark for good. */
  disable(room: Room): void {
    for (const cam of this.cameras) {
      if (cam.room !== room) continue;
      cam.disabled = true;
      cam.cone.clear();
      cam.sprite.setFrame('off');
    }
  }

  /** Call when the player enters a room. */
  roomEntered(): void {
    this.activeSince = this.scene.time.now + GRACE_MS;
  }

  update(room: Room): void {
    const now = this.scene.time.now;
    const feet = this.player.feet;
    for (const cam of this.cameras) {
      if (cam.room !== room || cam.disabled) {
        cam.cone.clear();
        continue;
      }
      const angle = cam.facing + Math.sin((now / SWEEP_MS) * Math.PI * 2 + cam.phase) * SWEEP;
      cam.sprite.setRotation(angle - Math.PI / 2);
      const range = RANGE * this.rangeScale();
      const alarmed = now < cam.rearmAt;
      this.drawCone(cam, angle, range, alarmed);

      if (now < this.activeSince || alarmed) continue;
      const dist = Phaser.Math.Distance.Between(cam.sprite.x, cam.sprite.y, feet.x, feet.y);
      const toPlayer = Phaser.Math.Angle.Between(cam.sprite.x, cam.sprite.y, feet.x, feet.y);
      if (dist < range && Math.abs(Phaser.Math.Angle.Wrap(toPlayer - angle)) < HALF_FOV) this.trip(cam);
    }
  }

  private drawCone(cam: Camera, angle: number, range: number, alarmed: boolean): void {
    const { x, y } = cam.sprite;
    // Keep the cone on the room's floor instead of spilling over the walls.
    const left = (cam.room.gx * ROOM_W + 1) * TILE;
    const top = (cam.room.gy * ROOM_H + 1) * TILE;
    const right = left + (ROOM_W - 2) * TILE;
    const bottom = top + (ROOM_H - 2) * TILE;
    const points = [new Phaser.Math.Vector2(x, y)];
    for (let i = 0; i <= 8; i++) {
      const a = angle - HALF_FOV + (i / 8) * HALF_FOV * 2;
      points.push(
        new Phaser.Math.Vector2(
          Phaser.Math.Clamp(x + Math.cos(a) * range, left, right),
          Phaser.Math.Clamp(y + Math.sin(a) * range, top, bottom),
        ),
      );
    }
    // Red while the alarm is on: it is still watching, just waiting to call more drones.
    const tint = color(alarmed ? PAL.red : PAL.yellow);
    cam.cone.clear().fillStyle(tint, 0.16).fillPoints(points, true);
    cam.cone.lineStyle(1, tint, 0.35).strokePoints(points, true);
  }

  private trip(cam: Camera): void {
    cam.rearmAt = this.scene.time.now + REARM_MS;
    const { x, y } = cam.sprite;
    const flash = this.scene.add.graphics().setDepth(-990);
    flash.fillStyle(color(PAL.red), 0.35).fillCircle(x, y, RANGE * 0.3);
    this.scene.tweens.add({ targets: flash, alpha: 0, duration: 500, onComplete: () => flash.destroy() });
    this.onSpotted(cam.room);
  }
}
