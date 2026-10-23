import Phaser from 'phaser';
import type { MoveInput } from '../entities/Player';

type KeyName = 'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'j' | 'k' | 'space';

/**
 * Keyboard controls: WSAD (or arrows) move, J swings the badge, K throws a pen, Space searches.
 * Kept separate so gamepad/touch can plug in later.
 */
export class Controls {
  private keys: Record<KeyName, Phaser.Input.Keyboard.Key>;

  constructor(scene: Phaser.Scene) {
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = scene.input.keyboard!.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT,
      w: K.W, a: K.A, s: K.S, d: K.D,
      j: K.J, k: K.K, space: K.SPACE,
    }) as Controls['keys'];
  }

  movement(): MoveInput {
    const k = this.keys;
    return {
      x: (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0),
      y: (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0),
    };
  }

  /** Held attack buttons repeat at the weapon's own cooldown. */
  get melee(): boolean {
    return this.keys.j.isDown;
  }

  get shoot(): boolean {
    return this.keys.k.isDown;
  }

  /** True only on the frame Space was pressed. */
  get interact(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.keys.space);
  }
}
