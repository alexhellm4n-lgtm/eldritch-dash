import type Phaser from 'phaser';
import { juiceConfig } from '../config';
import type { Entity } from '../systems/Entity';
import { TentacleChain } from './CutoutRig';
import gullRig from '../../assets-src/rigs/gull.generated.json';
import { palette } from './palette';
import { isRaster, unitImage, unitScale } from './textures';

/** Общий интерфейс отрисовки объекта трассы; экземпляры живут в пулах по типу. */
export interface EntityView {
  readonly root: Phaser.GameObjects.Container | Phaser.GameObjects.Image;
  /** Сброс перед повторным использованием. */
  bind(e: Entity): void;
  update(e: Entity, time: number, heroX: number, heroY: number): void;
}

const PUPIL_RANGE = 3.5;

/** Глаз, который следит за героем (SPEC §8.2). */
class TrackingEye {
  readonly white: Phaser.GameObjects.Image;
  readonly pupil: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    private readonly x: number,
    private readonly y: number,
    private readonly size = 1,
  ) {
    this.white = unitImage(scene, 'eye', x, y);
    this.white.setScale(this.white.scaleX * size);
    this.pupil = unitImage(scene, 'pupil', x, y);
    this.pupil.setScale(this.pupil.scaleX * size);
    parent.add([this.white, this.pupil]);
  }

  /** dx, dy — направление на героя в локальных координатах контейнера. */
  look(dx: number, dy: number): void {
    const len = Math.hypot(dx, dy) || 1;
    const r = PUPIL_RANGE * this.size;
    this.pupil.setPosition(this.x + (dx / len) * r, this.y + (dy / len) * r);
  }
}

/** Базовый класс твари: контейнер, развёрнутый к герою (влево), реакция на удар. */
abstract class CreatureView implements EntityView {
  readonly root: Phaser.GameObjects.Container;
  protected readonly eyes: TrackingEye[] = [];

  constructor(protected readonly scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0);
  }

  bind(): void {
    this.root.setVisible(true).setAlpha(1).setRotation(0).setScale(-1, 1);
  }

  /** Смещение «ступней» контейнера относительно центра AABB. */
  protected abstract anchorY(e: Entity): number;
  protected abstract animate(e: Entity, time: number): void;

  update(e: Entity, time: number, heroX: number, heroY: number): void {
    const x = e.x;
    const y = e.y + this.anchorY(e);
    // Отдача при ударе по бронированному врагу.
    const hurt = e.hurtT < 0.18 ? 1 - e.hurtT / 0.18 : 0;
    const jolt = hurt > 0 ? hurt * 6 * Math.sin(e.hurtT * 90) : 0;
    this.root.setPosition(x + jolt, y);
    this.root.setScale(-(1 + hurt * 0.15), 1 - hurt * 0.1);
    // Отработавший враг (столкнулся с героем) бледнеет и больше не опасен.
    this.root.setAlpha(e.spent ? 0.45 : 1);
    this.animate(e, time);
    for (const eye of this.eyes) {
      // Контейнер отражён по X: «вперёд» в локальных координатах — к герою.
      eye.look(-(heroX - x), heroY - y);
    }
  }
}

class FishmanView extends CreatureView {
  private readonly legF: Phaser.GameObjects.Image;
  private readonly legB: Phaser.GameObjects.Image;
  private readonly body: Phaser.GameObjects.Image;
  private readonly head: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.legB = unitImage(scene, 'fish_leg', -8, -24)
      .setOrigin(0.45, 0.08)
      .setTint(palette.farShade);
    this.legF = unitImage(scene, 'fish_leg', 8, -24).setOrigin(0.45, 0.08);
    this.body = unitImage(scene, 'fish_body', 0, -18).setOrigin(0.5, 1);
    this.head = unitImage(scene, 'fish_head', 2, -66).setOrigin(0.5, 0.85);
    this.root.add([this.legB, this.legF, this.body, this.head]);
    this.eyes.push(new TrackingEye(scene, this.root, 20, -94, 1.1));
  }

  protected anchorY(e: Entity): number {
    return e.h / 2;
  }

  protected animate(e: Entity, time: number): void {
    const s = Math.sin(e.t * 9);
    this.legF.setRotation(-0.5 * s);
    this.legB.setRotation(0.5 * s);
    const bob = -Math.abs(Math.cos(e.t * 9)) * 3;
    this.body.y = -18 + bob;
    this.head.y = -66 + bob;
    this.head.setRotation(0.08 * Math.sin(time * 2 + e.id));
    this.eyes[0]!.white.y = -94 + bob;
  }
}

class GullView extends CreatureView {
  private readonly wing: Phaser.GameObjects.Image;
  private readonly tentacle: TentacleChain;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.tentacle = new TentacleChain(scene, this.root, 0, 14, 6, 9, palette.sicklyViolet);
    this.root.add(unitImage(scene, 'gull_body'));
    this.eyes.push(new TrackingEye(scene, this.root, 20, -6, 0.8));
    this.wing = unitImage(scene, 'gull_wing', -6, -6).setOrigin(0.15, 0.85);
    this.root.add(this.wing);
  }

  protected anchorY(): number {
    return 0;
  }

  protected animate(e: Entity, time: number): void {
    this.wing.setRotation(-0.2 + 0.7 * Math.sin(e.t * 11));
    this.tentacle.update(time, 0.3, 0.18, 4, e.id);
  }
}

interface PartWing {
  img: Phaser.GameObjects.Image;
  base: number;
  amp: number;
  phase: number;
}

/** Чайка из сгенерированных частей: два машущих крыла, качающееся щупальце, зрачок в пустом глазу. */
class GeneratedGullView extends CreatureView {
  private readonly wings: PartWing[] = [];
  private readonly tentacle: Phaser.GameObjects.Image;
  private readonly tentacleUnit: number;
  private readonly pupil: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    super(scene);
    const rig = gullRig;
    const back: Phaser.GameObjects.Image[] = [];
    const front: Phaser.GameObjects.Image[] = [];
    for (const w of rig.wings) {
      const img = unitImage(scene, 'gull_wing', w.x, w.y).setOrigin(w.ox, w.oy).setFlipX(w.flip);
      if (w.shade) img.setTint(palette.farShade);
      (w.behind ? back : front).push(img);
      this.wings.push({ img, base: w.base, amp: w.amp, phase: w.phase });
    }
    const t = rig.tentacle;
    this.tentacle = unitImage(scene, 'gull_tentacle', t.x, t.y).setOrigin(t.ox, t.oy);
    this.tentacleUnit = this.tentacle.scaleX;
    const body = unitImage(scene, 'gull_body').setOrigin(rig.body.ox, rig.body.oy);
    this.pupil = unitImage(scene, 'pupil', rig.eye.x, rig.eye.y);
    this.pupil.setScale(this.pupil.scaleX * rig.eye.pupilScale);
    this.root.add([...back, this.tentacle, body, ...front, this.pupil]);
  }

  protected anchorY(): number {
    return 0;
  }

  protected animate(e: Entity, time: number): void {
    for (const w of this.wings) {
      w.img.setRotation(w.base + w.amp * Math.sin(e.t * gullRig.flapFreq + w.phase));
    }
    const t = gullRig.tentacle;
    const sway = Math.sin(time * t.freq + e.id);
    this.tentacle
      .setRotation(t.amp * sway)
      .setScale(this.tentacleUnit, this.tentacleUnit * (1 + 0.06 * Math.cos(time * t.freq + e.id)));
  }

  override update(e: Entity, time: number, heroX: number, heroY: number): void {
    super.update(e, time, heroX, heroY);
    // Контейнер отражён по X: «к герою» в локальных координатах — это −(heroX − x).
    const dx = -(heroX - e.x);
    const dy = heroY - e.y;
    const len = Math.hypot(dx, dy) || 1;
    const r = gullRig.eye.range;
    this.pupil.setPosition(gullRig.eye.x + (dx / len) * r, gullRig.eye.y + (dy / len) * r);
  }
}

class SquidView extends CreatureView {
  private readonly mantle: Phaser.GameObjects.Image;
  private readonly tentacles: TentacleChain[] = [];

  constructor(scene: Phaser.Scene) {
    super(scene);
    for (let i = 0; i < 4; i++) {
      this.tentacles.push(
        new TentacleChain(scene, this.root, -18 + i * 12, 18, 4, 8, palette.coral, 0.9),
      );
    }
    this.mantle = unitImage(scene, 'squid_mantle', 0, 0).setOrigin(0.5, 0.6);
    this.root.add(this.mantle);
    this.eyes.push(new TrackingEye(scene, this.root, 6, -4, 1.5));
  }

  protected anchorY(): number {
    return 0;
  }

  protected animate(e: Entity, time: number): void {
    // Вытягивается в полёте и сплющивается у земли.
    const lift = (e.baseY - e.y) / Math.max(e.h, 1);
    const stretch = Math.min(lift * 0.12, 0.15);
    this.mantle.setScale(
      unitScale('squid_mantle') * (1 - stretch),
      unitScale('squid_mantle') * (1 + stretch),
    );
    for (let i = 0; i < this.tentacles.length; i++) {
      this.tentacles[i]!.update(time, (i - 1.5) * 0.15, 0.2 + stretch, 6, i * 1.3 + e.id);
    }
  }
}

class NetView extends CreatureView {
  private readonly legF: Phaser.GameObjects.Image;
  private readonly legB: Phaser.GameObjects.Image;
  private readonly body: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.legB = unitImage(scene, 'fish_leg', -16, -18).setOrigin(0.45, 0.08).setTint(palette.rope);
    this.legF = unitImage(scene, 'fish_leg', 16, -18).setOrigin(0.45, 0.08).setTint(palette.rope);
    this.body = unitImage(scene, 'net_body', 0, -6).setOrigin(0.5, 1);
    this.root.add([this.legB, this.legF, this.body]);
    this.eyes.push(new TrackingEye(scene, this.root, 4, -60, 1));
    this.eyes.push(new TrackingEye(scene, this.root, 26, -58, 1));
  }

  protected anchorY(e: Entity): number {
    return e.h / 2;
  }

  protected animate(e: Entity): void {
    const s = Math.sin(e.t * 7);
    this.legF.setRotation(-0.45 * s);
    this.legB.setRotation(0.45 * s);
    this.body.setRotation(0.05 * s);
    // Броня пробита — сеть «темнеет».
    this.body.setTint(e.hp < 2 ? palette.crackedShade : 0xffffff);
  }
}

class CoinView implements EntityView {
  readonly root: Phaser.GameObjects.Image;
  private readonly unit: number;

  constructor(scene: Phaser.Scene) {
    this.root = unitImage(scene, 'coin');
    this.unit = unitScale('coin');
  }

  bind(): void {
    this.root.setVisible(true).setAlpha(1);
  }

  update(e: Entity, time: number): void {
    // Вращение монеты — сжатие по X.
    const spin = Math.cos(time * juiceConfig.coinSpinPerSec + e.x * 0.01);
    this.root.setPosition(e.x, e.y + Math.sin(time * 3 + e.x * 0.02) * 3);
    this.root.setScale(this.unit * Math.max(Math.abs(spin), 0.15), this.unit);
  }
}

class ObstacleView implements EntityView {
  readonly root: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, key: string) {
    this.root = unitImage(scene, key);
  }

  bind(): void {
    this.root.setVisible(true).setAlpha(1).setRotation(0).clearTint();
  }

  update(e: Entity): void {
    this.root.setPosition(e.x, e.y);
    if (e.spent) {
      // Задетое препятствие опрокидывается и бледнеет.
      this.root
        .setRotation(Math.min(this.root.rotation + 0.04, 0.35))
        .setAlpha(0.7)
        .setTint(palette.spentShade);
    }
  }
}

/** Фабрика представлений по ключу типа (тип врага / препятствия / 'coin'). */
export function createEntityView(scene: Phaser.Scene, e: Entity): EntityView {
  if (e.kind === 'coin') return new CoinView(scene);
  if (e.kind === 'obstacle') return new ObstacleView(scene, e.type);
  switch (e.type) {
    case 'fishman':
      return new FishmanView(scene);
    case 'gull':
      return isRaster('gull_body') ? new GeneratedGullView(scene) : new GullView(scene);
    case 'squidling':
      return new SquidView(scene);
    case 'walkingNet':
      return new NetView(scene);
    default:
      throw new Error(`Нет представления для врага ${e.type}`);
  }
}

/** Ключ пула: представления одного ключа взаимозаменяемы. */
export function viewKey(e: Entity): string {
  return e.kind === 'coin' ? 'coin' : e.type;
}
