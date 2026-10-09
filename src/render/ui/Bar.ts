import type Phaser from 'phaser';
import { palette } from '../palette';
import { isRaster } from '../textures';
import { addStrip } from './Button';
import skin from './skin.json';

/** Доля высоты рамки, которую занимает заливка, и отступ заливки от концов рамки (доли). */
const FILL_H = 0.42;
const FILL_INSET = 0.11;

/**
 * Шкала HUD: деревянная рамка с канатами и латунными концами, внутри — светлая заливка,
 * тонированная в нужный цвет. Без растра — прямоугольники. x, y — левый край по центру высоты.
 */
export class Bar {
  private readonly frame: Phaser.GameObjects.NineSlice | Phaser.GameObjects.Rectangle;
  private readonly fill: Phaser.GameObjects.NineSlice | Phaser.GameObjects.Rectangle;
  private readonly fillX: number;
  private readonly fillW: number;
  private readonly raster: boolean;
  private progress = -1;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly w: number,
    readonly h: number,
    color: number,
  ) {
    this.raster = isRaster(skin.bar.key) && isRaster(skin.barFill.key);
    if (this.raster) {
      this.frame = addStrip(scene, skin.bar, x + w / 2, y, w, h)!;
      this.fillX = x + w * FILL_INSET;
      this.fillW = w * (1 - FILL_INSET * 2);
      this.fill = addStrip(scene, skin.barFill, this.fillX, y, this.fillW, h * FILL_H)!.setOrigin(
        0,
        0.5,
      );
    } else {
      this.frame = scene.add.rectangle(x, y, w + 6, h, palette.outline).setOrigin(0, 0.5);
      this.fillX = x + 3;
      this.fillW = w;
      this.fill = scene.add.rectangle(this.fillX, y, w, h - 6, color).setOrigin(0, 0.5);
    }
    this.setColor(color);
    this.setProgress(1);
  }

  /** 0..1 */
  setProgress(k: number): this {
    const p = Math.max(0, Math.min(1, k));
    if (p === this.progress) return this;
    this.progress = p;
    if (this.raster) {
      const f = this.fill as Phaser.GameObjects.NineSlice;
      // Концы заливки не сжимаются: пустая шкала — просто скрытая заливка.
      const minW = (skin.barFill.left + skin.barFill.right) * f.scaleX;
      const w = this.fillW * p;
      f.setVisible(w >= minW * 0.6);
      f.setSize(Math.max(w, minW) / f.scaleX, f.height);
    } else {
      (this.fill as Phaser.GameObjects.Rectangle).setScale(Math.max(0.001, p), 1);
    }
    return this;
  }

  setColor(color: number): this {
    if (this.raster) (this.fill as Phaser.GameObjects.NineSlice).setTint(color);
    else (this.fill as Phaser.GameObjects.Rectangle).setFillStyle(color);
    return this;
  }

  setAlpha(a: number): this {
    this.fill.setAlpha(a);
    return this;
  }

  setVisible(v: boolean): this {
    this.frame.setVisible(v);
    this.fill.setVisible(v && this.progress > 0);
    return this;
  }

  /** Объекты шкалы — чтобы положить их в контейнер. */
  get objects(): Phaser.GameObjects.GameObject[] {
    return [this.frame, this.fill];
  }
}
