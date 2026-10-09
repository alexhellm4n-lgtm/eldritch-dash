import Phaser from 'phaser';
import display from '../config/display.json';
import { TentacleChain } from './CutoutRig';
import { Depth } from './Parallax';
import { palette } from './palette';
import { isRaster, unitImage, unitScale } from './textures';

const RISE_PER_SEC = 3;
/** Векторный запасной вариант: цепочки из сегментов. */
const CHAINS = 7;
/** Сгенерированные щупальца: основание по X, размах наклона, размер. */
const TENTACLES = [
  { x: 40, lean: 0.35, size: 1.15 },
  { x: 480, lean: -0.15, size: 0.95 },
  { x: 700, lean: 0.2, size: 1.25 },
  { x: 900, lean: -0.3, size: 1.0 },
  { x: 1090, lean: 0.1, size: 1.3 },
  { x: 1250, lean: -0.4, size: 1.05 },
] as const;
const TENTACLE_KEYS = ['awaken_tentacle_a', 'awaken_tentacle_b', 'awaken_tentacle_c'];
const ROPE_POINTS = 14;
/** Щупальце сжато по длине: толще и короче, чем на листе. */
const LENGTH_K = 0.6;
/** Насколько основание щупальца уходит под настил. */
const BASE_BELOW = 50;
const GLOW_TILES = 5;
const SPARKS = 18;
const SPARKS_PER_SEC = 14;
const SIGIL_Y = 250;

interface Tentacle {
  rope: Phaser.GameObjects.Rope;
  x: number;
  lean: number;
  /** Длина в пикселях текстуры: точки рёпа задаются до масштабирования. */
  len: number;
  /** Длина в игровых единицах — на сколько прятать под настил. */
  height: number;
  phase: number;
}

interface Spark {
  img: Phaser.GameObjects.Image;
  vx: number;
  vy: number;
  t: number;
  life: number;
}

/**
 * «Пробуждение» (SPEC §4.4): из-под настила вырываются гигантские щупальца, из щелей
 * поднимается бирюзово-фиолетовое свечение, в небе разворачивается сигил, летят искры.
 * Сгенерированные щупальца натянуты на Rope и изгибаются целиком; без растра — цепочки сегментов.
 */
export class AwakeningFx {
  private readonly layer: Phaser.GameObjects.Container;
  private readonly glow: Phaser.GameObjects.Rectangle;
  private readonly chains: TentacleChain[] = [];
  private readonly tentacles: Tentacle[] = [];
  private readonly glowTiles: Phaser.GameObjects.Image[] = [];
  private readonly sparks: Spark[] = [];
  private readonly sigil: Phaser.GameObjects.Image | null = null;
  private level = 0;
  private active = false;
  /** Время с начала Пробуждения — для разворота сигила. */
  private sinceStart = Infinity;
  private sparkDebt = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly groundY: number,
  ) {
    this.layer = scene.add
      .container(0, 0)
      .setScrollFactor(0)
      .setDepth(Depth.near + 0.5);
    if (isRaster(TENTACLE_KEYS[0]!)) {
      TENTACLES.forEach((d, i) => {
        const key = TENTACLE_KEYS[i % TENTACLE_KEYS.length]!;
        const frame = scene.textures.getFrame(key);
        const points = Array.from({ length: ROPE_POINTS }, () => ({ x: 0, y: 0 }));
        const scale = unitScale(key) * d.size;
        const rope = scene.add
          .rope(d.x, groundY, key, undefined, points, true)
          .setScale(scale)
          .setScrollFactor(0)
          .setDepth(Depth.near + 0.5)
          .setVisible(false);
        this.tentacles.push({
          rope,
          x: d.x,
          lean: d.lean,
          len: frame.width * LENGTH_K,
          height: frame.width * LENGTH_K * scale,
          phase: i * 1.9,
        });
      });
    } else {
      for (let i = 0; i < CHAINS; i++) {
        const x = ((i + 0.5) / CHAINS) * display.width;
        const tint = i % 2 === 0 ? palette.sicklyViolet : palette.bioCyan;
        this.chains.push(new TentacleChain(scene, this.layer, x, groundY + 20, 10, 15, tint, 1.9));
      }
    }

    if (isRaster('awaken_sigil')) {
      this.sigil = unitImage(scene, 'awaken_sigil', display.width / 2, SIGIL_Y)
        .setScrollFactor(0)
        .setDepth(Depth.fogBack + 0.5)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false);
    }
    if (isRaster('awaken_glow')) {
      const step = display.width / (GLOW_TILES - 1);
      for (let i = 0; i < GLOW_TILES; i++) {
        this.glowTiles.push(
          unitImage(scene, 'awaken_glow', i * step, groundY + 24)
            .setOrigin(0.5, 1)
            .setFlipX(i % 2 === 1)
            .setScrollFactor(0)
            .setDepth(Depth.ground + 0.5)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setVisible(false),
        );
      }
    }
    if (isRaster('awaken_spark')) {
      for (let i = 0; i < SPARKS; i++) {
        this.sparks.push({
          img: unitImage(scene, 'awaken_spark')
            .setScrollFactor(0)
            .setDepth(Depth.fx)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setVisible(false),
          vx: 0,
          vy: 0,
          t: Infinity,
          life: 1,
        });
      }
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
    if (active && !this.active) this.sinceStart = 0;
    this.active = active;
  }

  update(dt: number, time: number): void {
    const target = this.active ? 1 : 0;
    this.level +=
      Math.sign(target - this.level) * Math.min(Math.abs(target - this.level), dt * RISE_PER_SEC);
    this.sinceStart += dt;
    const visible = this.level > 0.001;
    this.layer.setVisible(visible && this.chains.length > 0);
    for (const t of this.tentacles) t.rope.setVisible(visible);
    for (const g of this.glowTiles) g.setVisible(visible);
    this.sigil?.setVisible(visible);
    this.updateSparks(dt);
    if (!visible) {
      this.glow.setAlpha(0);
      return;
    }

    // Поднимаются из-под земли и извиваются.
    this.layer.setY((1 - this.level) * 260);
    this.chains.forEach((c, i) =>
      c.update(time, Math.PI + 0.25 * Math.sin(time + i), 0.16, 3 + i * 0.3, i * 1.7),
    );
    for (const t of this.tentacles) this.bend(t, time);

    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    const gu = unitScale('awaken_glow');
    this.glowTiles.forEach((g, i) =>
      g
        .setAlpha(this.level * (0.55 + 0.3 * Math.sin(time * 5 + i * 1.3)))
        .setScale(gu * 1.15, gu * (0.8 + 0.2 * pulse)),
    );
    if (this.sigil) {
      // Вспыхивает и разворачивается, затем тихо вращается в небе.
      const open = Math.min(1, this.sinceStart / 0.6);
      const flash = Math.max(0, 1 - this.sinceStart / 0.9);
      this.sigil
        .setScale(unitScale('awaken_sigil') * (0.3 + 1.1 * (1 - (1 - open) ** 3)))
        .setRotation(time * 0.25)
        .setAlpha(this.level * (0.45 + 0.1 * pulse + 0.45 * flash));
    }
    if (this.active) {
      this.sparkDebt += dt * SPARKS_PER_SEC;
      while (this.sparkDebt >= 1) {
        this.sparkDebt -= 1;
        this.spawnSpark();
      }
    }
    this.glow
      .setFillStyle(pulse > 0.5 ? palette.bioCyan : palette.sicklyViolet)
      .setAlpha(this.level * (0.05 + 0.04 * pulse));
  }

  /** Точки рёпа от основания вверх: изгиб нарастает к кончику и бежит волной. */
  private bend(t: Tentacle, time: number): void {
    const pts = t.rope.points;
    const step = t.len / (pts.length - 1);
    let x = 0;
    let y = 0;
    let angle = -Math.PI / 2 + t.lean * Math.sin(time * 0.7 + t.phase);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]!;
      p.x = x;
      p.y = y;
      const k = i / (pts.length - 1);
      angle += (0.05 + 0.12 * k) * Math.sin(time * 2.6 + t.phase - i * 0.55);
      x += Math.cos(angle) * step;
      y += Math.sin(angle) * step;
    }
    t.rope.setPosition(t.x, this.groundY + BASE_BELOW + (1 - this.level) * (t.height + 40));
    t.rope.setDirty();
  }

  private spawnSpark(): void {
    const s = this.sparks.find((p) => p.t >= p.life);
    if (!s) return;
    s.t = 0;
    s.life = 0.8 + Math.random() * 0.8;
    s.vx = (Math.random() - 0.5) * 60;
    s.vy = -(140 + Math.random() * 180);
    s.img
      .setPosition(Math.random() * display.width, this.groundY - Math.random() * 30)
      .setRotation(Math.random() * Math.PI)
      .setVisible(true);
  }

  private updateSparks(dt: number): void {
    for (const s of this.sparks) {
      if (s.t >= s.life) continue;
      s.t += dt;
      if (s.t >= s.life) {
        s.img.setVisible(false);
        continue;
      }
      const k = s.t / s.life;
      s.img
        .setPosition(s.img.x + s.vx * dt, s.img.y + s.vy * dt)
        .setScale(unitScale('awaken_spark') * (0.5 + 0.7 * Math.sin(k * Math.PI)))
        .setAlpha(1 - k * k);
    }
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
