import type Phaser from 'phaser';
import { juiceConfig } from '../config';
import { Depth } from './Parallax';

/**
 * Мягкие тени на земле под героем, тварями, препятствиями и монетами. Тень лежит на уровне
 * земли под объектом, сужается и бледнеет с высотой — видно, на какой высоте летит объект.
 * Пул картинок без аллокаций: каждый кадр `begin()` → `cast()` для каждого объекта → `end()`.
 */
export class Shadows {
  private readonly pool: Phaser.GameObjects.Image[] = [];
  private used = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly groundY: number,
  ) {}

  begin(): void {
    this.used = 0;
  }

  /**
   * @param x центр объекта по X
   * @param width ширина объекта
   * @param bottomY нижний край объекта
   * @param alpha собственная прозрачность объекта (проступающие препятствия)
   * @param k доля ширины объекта (у монет тень уже)
   */
  cast(x: number, width: number, bottomY: number, alpha = 1, k = juiceConfig.shadow.widthK): void {
    const cfg = juiceConfig.shadow;
    const lift = Math.max(0, this.groundY - bottomY);
    const near = 1 - lift / cfg.fadeLiftPx;
    if (near <= 0 || alpha <= 0) return;
    let img = this.pool[this.used];
    if (!img) {
      img = this.scene.add.image(0, 0, 'shadow_blob').setDepth(Depth.shadow);
      this.pool.push(img);
    }
    this.used++;
    const w = width * k * (0.55 + 0.45 * near);
    img
      .setVisible(true)
      .setPosition(x, this.groundY + cfg.offsetY)
      .setDisplaySize(w, cfg.heightPx * (0.6 + 0.4 * near))
      .setAlpha(cfg.alpha * near * alpha);
  }

  end(): void {
    for (let i = this.used; i < this.pool.length; i++) this.pool[i]!.setVisible(false);
  }
}
