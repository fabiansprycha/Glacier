import Phaser from 'phaser';
import { RENDER_SCALE } from '../../core/config';

/**
 * Makes a UI scene lay out in logical pixels (VIEW_W x VIEW_H) on the RENDER_SCALE-times larger canvas,
 * and renders its text at full resolution so it stays sharp. Call first thing in create().
 */
export function hiDpi(scene: Phaser.Scene): void {
  scene.cameras.main.setOrigin(0, 0).setZoom(RENDER_SCALE);
  const events = scene.sys.events;
  const sharpen = (obj: Phaser.GameObjects.GameObject) => {
    if (obj instanceof Phaser.GameObjects.Text) obj.setResolution(RENDER_SCALE);
  };
  events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, sharpen);
  events.once(Phaser.Scenes.Events.SHUTDOWN, () => events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, sharpen));
}
