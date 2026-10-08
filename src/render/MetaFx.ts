import Phaser from 'phaser';
import display from '../config/display.json';
import { TentacleChain } from './CutoutRig';
import { Depth } from './Parallax';
import { palette } from './palette';

const TENTACLES = 7;
const RISE_PER_SEC = 3;

/**
 * «Пробуждение» (SPEC §4.4): из-под настила вырываются щупальца по всему экрану,
 * мир заливает бирюзово-фиолетовым свечением.
 */
export class AwakeningFx {
  private readonly layer: Phaser.GameObjects.Container;
  private readonly glow: Phaser.GameObjects.Rectangle;
  private readonly chains: TentacleChain[] = [];
  private level = 0;
  private active = false;

  constructor(scene: Phaser.Scene, groundY: number) {
    this.layer = scene.add
      .container(0, 0)
      .setScrollFactor(0)
      .setDepth(Depth.near + 0.5);
    for (let i = 0; i < TENTACLES; i++) {
      const x = ((i + 0.5) / TENTACLES) * display.width;
      const tint = i % 2 === 0 ? palette.sicklyViolet : palette.bioCyan;
      this.chains.push(new TentacleChain(scene, this.layer, x, groundY + 20, 10, 15, tint, 1.9));
    }
    this.glow = scene.add
      .rectangle(0, 0, display.width, display.height, palette.bioCyan, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(Depth.fogFront + 1)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.layer.setVisible(false);
  }

  setActive(active: boolean): void {
    this.active = active;
  }

  update(dt: number, time: number): void {
    const target = this.active ? 1 : 0;
    this.level +=
      Math.sign(target - this.level) * Math.min(Math.abs(target - this.level), dt * RISE_PER_SEC);
    const visible = this.level > 0.001;
    this.layer.setVisible(visible);
    if (!visible) {
      this.glow.setAlpha(0);
      return;
    }
    // Поднимаются из-под земли и извиваются.
    this.layer.setY((1 - this.level) * 260);
    this.chains.forEach((c, i) =>
      c.update(time, Math.PI + 0.25 * Math.sin(time + i), 0.16, 3 + i * 0.3, i * 1.7),
    );
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    this.glow
      .setFillStyle(pulse > 0.5 ? palette.bioCyan : palette.sicklyViolet)
      .setAlpha(this.level * (0.08 + 0.05 * pulse));
  }
}

/**
 * Искажения при низком рассудке (SPEC §4.3, §8.3): волны (смещение по шуму), уход цветов
 * в фиолетовый и тёмная виньетка. «Уменьшить искажения» гасит волны и ослабляет остальное.
 */
export class Distortion {
  private readonly displace: Phaser.Filters.Displacement | null = null;
  private readonly color: Phaser.Filters.ColorMatrix | null = null;
  private readonly vignette: Phaser.Filters.Vignette | null = null;

  constructor(camera: Phaser.Cameras.Scene2D.Camera) {
    // Фильтры есть только в WebGL; в Canvas искажения просто отключены.
    const filters = (camera as { filters?: Phaser.Types.GameObjects.FiltersInternalExternal })
      .filters;
    if (!filters) return;
    this.displace = filters.internal.addDisplacement('noise_displace', 0, 0);
    this.color = filters.internal.addColorMatrix();
    this.vignette = filters.internal.addVignette(0.5, 0.5, 0.75, 0, palette.violetDeep);
    this.apply(0, 0, false);
  }

  /** k — сила искажений 0..1 (0 — рассудок выше порога). */
  apply(k: number, time: number, reduce: boolean): void {
    const on = k > 0.001;
    const strength = reduce ? k * 0.35 : k;
    if (this.displace) {
      this.displace.active = on && !reduce;
      const amp = 0.012 * strength;
      this.displace.x = amp * Math.sin(time * 1.3);
      this.displace.y = amp * Math.cos(time * 0.9);
    }
    if (this.color) {
      this.color.active = on;
      this.color.colorMatrix.reset();
      this.color.colorMatrix.hue(-40 * strength);
      this.color.colorMatrix.saturate(-0.35 * strength, true);
    }
    if (this.vignette) {
      this.vignette.active = on;
      this.vignette.strength = 0.65 * strength;
    }
  }
}
