import Phaser from 'phaser';
import { juiceConfig } from '../config';
import { Depth } from './Parallax';
import { unitImage, unitScale } from './textures';

interface Shot {
  muzzle: Phaser.GameObjects.Image;
  bolt: Phaser.GameObjects.Image;
  impact: Phaser.GameObjects.Image;
  /** Точка попадания (мировые координаты). */
  tx: number;
  ty: number;
  /** Время с выстрела, с; Infinity — свободен. */
  t: number;
}

const POOL = 4;
/** Длина «тела» луча в текстуре (от хвоста до головы), доля ширины. */
const BOLT_BODY = 0.9;

/**
 * Выстрел фонаря: вспышка у фонаря, луч света до твари, всплеск попадания.
 * Всё аддитивно, из пула, без твинов (на каждый выстрел — ноль аллокаций).
 */
export class LanternFx {
  private readonly shots: Shot[] = [];
  private next = 0;
  private readonly boltLen: number;

  constructor(scene: Phaser.Scene) {
    const add = (key: string): Phaser.GameObjects.Image =>
      unitImage(scene, key)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(Depth.fx)
        .setVisible(false);
    for (let i = 0; i < POOL; i++) {
      this.shots.push({
        muzzle: add('fx_muzzle'),
        bolt: add('fx_bolt').setOrigin(BOLT_BODY, 0.5),
        impact: add('fx_impact'),
        tx: 0,
        ty: 0,
        t: Infinity,
      });
    }
    const boltTex = scene.textures.get('fx_bolt').getSourceImage() as { width: number };
    this.boltLen = boltTex.width * unitScale('fx_bolt') * BOLT_BODY;
  }

  fire(fromX: number, fromY: number, toX: number, toY: number): void {
    const s = this.shots[this.next]!;
    this.next = (this.next + 1) % this.shots.length;
    s.t = 0;
    s.tx = toX;
    s.ty = toY;
    s.muzzle.setRotation(Math.random() * Math.PI).setVisible(true);
    s.bolt.setVisible(true);
    s.impact
      .setPosition(toX, toY)
      .setRotation(Math.random() * Math.PI)
      .setVisible(true);
    this.update(0, fromX, fromY);
  }

  /** lanternX/Y — текущее положение фонаря: вспышка и хвост луча следуют за бегущим героем. */
  update(dtSec: number, lanternX: number, lanternY: number): void {
    const life = juiceConfig.shot;
    for (const s of this.shots) {
      if (s.t === Infinity) continue;
      s.t += dtSec;
      const m = s.t / life.muzzleSec;
      const b = s.t / life.boltSec;
      const k = s.t / life.impactSec;
      s.muzzle.setPosition(lanternX, lanternY);
      setFx(s.muzzle, m, 'fx_muzzle', 0.4 + 0.8 * Math.min(m, 1));
      if (b < 1) {
        // Голова луча у цели, хвост растянут до фонаря.
        const dx = s.tx - lanternX;
        const dy = s.ty - lanternY;
        const stretch = Math.max(1, Math.hypot(dx, dy)) / this.boltLen;
        const u = unitScale('fx_bolt');
        s.bolt
          .setPosition(s.tx, s.ty)
          .setRotation(Math.atan2(dy, dx))
          .setScale(u * stretch, u * (1.2 - 0.7 * b))
          .setAlpha(1 - b * b);
      } else s.bolt.setVisible(false);
      setFx(s.impact, k, 'fx_impact', 0.5 + 0.9 * Math.min(k, 1));
      if (m >= 1 && b >= 1 && k >= 1) s.t = Infinity;
    }
  }

  shift(dx: number): void {
    for (const s of this.shots) {
      if (s.t === Infinity) continue;
      s.tx += dx;
      s.impact.x += dx;
    }
  }
}

/** Вспышка/всплеск: растёт и гаснет за отведённое время (progress 0..1). */
function setFx(img: Phaser.GameObjects.Image, progress: number, key: string, scale: number): void {
  if (progress >= 1) {
    img.setVisible(false);
    return;
  }
  img.setScale(unitScale(key) * scale).setAlpha(1 - progress);
}
