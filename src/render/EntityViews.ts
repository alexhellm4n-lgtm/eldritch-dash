import Phaser from 'phaser';
import { juiceConfig, sanityConfig } from '../config';
import { Entity } from '../systems/Entity';
import { TentacleChain } from './CutoutRig';
import fishmanRig from '../../assets-src/rigs/fishman.generated.json';
import gullRig from '../../assets-src/rigs/gull.generated.json';
import netRig from '../../assets-src/rigs/net.generated.json';
import squidRig from '../../assets-src/rigs/squid.generated.json';
import cultistGenRig from '../../assets-src/rigs/cultist.generated.json';
import eyeBushGenRig from '../../assets-src/rigs/eyeBush.generated.json';
import fireflyGenRig from '../../assets-src/rigs/firefly.generated.json';
import rootCrawlerGenRig from '../../assets-src/rigs/rootCrawler.generated.json';
import polypGenRig from '../../assets-src/rigs/polyp.generated.json';
import starJellyGenRig from '../../assets-src/rigs/starJelly.generated.json';
import wrongCubeGenRig from '../../assets-src/rigs/wrongCube.generated.json';
import deepPriestGenRig from '../../assets-src/rigs/deepPriest.generated.json';
import reefKeeperGenRig from '../../assets-src/rigs/reefKeeper.generated.json';
import rootMotherGenRig from '../../assets-src/rigs/rootMother.generated.json';
import greatSleeperGenRig from '../../assets-src/rigs/greatSleeper.generated.json';
import cultistRig from '../../assets-src/rigs/cultist.json';
import eyeBushRig from '../../assets-src/rigs/eyeBush.json';
import fireflyRig from '../../assets-src/rigs/firefly.json';
import rootCrawlerRig from '../../assets-src/rigs/rootCrawler.json';
import polypRig from '../../assets-src/rigs/polyp.json';
import starJellyRig from '../../assets-src/rigs/starJelly.json';
import wrongCubeRig from '../../assets-src/rigs/wrongCube.json';
import deepPriestRig from '../../assets-src/rigs/deepPriest.json';
import reefKeeperRig from '../../assets-src/rigs/reefKeeper.json';
import rootMotherRig from '../../assets-src/rigs/rootMother.json';
import greatSleeperRig from '../../assets-src/rigs/greatSleeper.json';
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
  /** Ореол мини-босса (создаётся, когда вид впервые достаётся мини-боссу). */
  private halo: Phaser.GameObjects.Image | null = null;

  constructor(protected readonly scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0);
  }

  /** Ореол мини-босса: пульсирующее свечение за тварью. */
  private updateHalo(e: Entity, time: number): void {
    if (!e.elite) {
      this.halo?.setVisible(false);
      return;
    }
    if (!this.halo) {
      this.halo = unitImage(this.scene, 'glow')
        .setTint(palette.coral)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.root.addAt(this.halo, 0);
    }
    const centerY = -this.anchorY(e) / e.scale;
    this.halo
      .setVisible(true)
      .setPosition(0, centerY)
      .setDisplaySize((e.w / e.scale) * 2.2, (e.h / e.scale) * 1.9)
      .setAlpha(0.45 + 0.2 * Math.sin(time * 5 + e.id));
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
    this.root.setScale(-(1 + hurt * 0.15) * e.scale, (1 - hurt * 0.1) * e.scale);
    this.updateHalo(e, time);
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

/** Описание твари из сгенерированных частей (assets-src/rigs/*.generated.json). */
interface CreatureRig {
  /** feet — контейнер стоит на ступнях (нижний край AABB), center — в центре AABB. */
  anchor: string;
  parts: readonly {
    name: string;
    key: string;
    x: number;
    y: number;
    ox: number;
    oy: number;
    shade?: boolean;
    scale?: number;
    flip?: boolean;
    /** Качание: base + amp × sin(время × freq + phase). */
    swing?: { amp: number; freq: number; phase?: number; base?: number };
    /** Пульсация масштаба: 1 + amp × sin(время × freq). */
    pulse?: { amp: number; freq: number };
  }[];
  /** «Крот»: под землёй вместо твари виден холмик. */
  burrow?: boolean;
  /** Зрачки поверх пустых глаз: смещение от точки вращения родительской части. */
  eyes: readonly { parent: string; x: number; y: number; pupilScale: number; range: number }[];
  walk?: {
    legs: readonly string[];
    amp: number;
    freq: number;
    legBase: number;
    bob: number;
    bobParts: readonly string[];
    wobble?: string;
    sway?: string;
  };
  tentacles?: { names: readonly string[]; amp: number; freq: number; stretchPart: string };
  /** Часть, которая темнеет, когда броня пробита. */
  armor?: string;
}

interface RigEye {
  parent: Phaser.GameObjects.Image;
  pupil: Phaser.GameObjects.Image;
  x: number;
  y: number;
  range: number;
}

/** Тварь из сгенерированных частей: ходьба или щупальца, зрачки следят за героем. */
class RigCreatureView extends CreatureView {
  private readonly parts = new Map<string, Phaser.GameObjects.Image>();
  private readonly base = new Map<string, { x: number; y: number; s: number }>();
  private readonly eyesOfRig: RigEye[] = [];
  private readonly mound: Phaser.GameObjects.Image | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly rig: CreatureRig,
  ) {
    super(scene);
    for (const p of rig.parts) {
      const img = unitImage(scene, p.key, p.x, p.y)
        .setOrigin(p.ox, p.oy)
        .setFlipX(p.flip === true);
      img.setScale(img.scaleX * (p.scale ?? 1));
      if (p.shade) img.setTint(palette.farShade);
      this.root.add(img);
      this.parts.set(p.name, img);
      this.base.set(p.name, { x: p.x, y: p.y, s: img.scaleX });
    }
    for (const e of rig.eyes) {
      const pupil = unitImage(scene, 'pupil');
      pupil.setScale(pupil.scaleX * e.pupilScale);
      this.root.add(pupil);
      this.eyesOfRig.push({ parent: this.part(e.parent), pupil, x: e.x, y: e.y, range: e.range });
    }
    if (rig.burrow) {
      this.mound = unitImage(scene, 'mound').setOrigin(0.5, 1).setVisible(false);
      this.root.add(this.mound);
    }
  }

  private part(name: string): Phaser.GameObjects.Image {
    const p = this.parts.get(name);
    if (!p) throw new Error(`Нет части ${name}`);
    return p;
  }

  protected anchorY(e: Entity): number {
    return this.rig.anchor === 'feet' ? e.h / 2 : 0;
  }

  protected animate(e: Entity, time: number): void {
    for (const [name, b] of this.base) this.part(name).setPosition(b.x, b.y).setRotation(0);
    for (const p of this.rig.parts) {
      const img = this.part(p.name);
      if (p.swing) {
        const w = p.swing;
        img.setRotation((w.base ?? 0) + w.amp * Math.sin(time * w.freq + (w.phase ?? 0) + e.id));
      }
      if (p.pulse) {
        const k = 1 + p.pulse.amp * Math.sin(time * p.pulse.freq + e.id);
        const b = this.base.get(p.name)!.s;
        img.setScale(b * k);
      }
    }
    const walk = this.rig.walk;
    if (walk) {
      const s = Math.sin(e.t * walk.freq);
      walk.legs.forEach((n, i) =>
        this.part(n).setRotation(walk.legBase + (i === 0 ? -1 : 1) * walk.amp * s),
      );
      const bob = -Math.abs(Math.cos(e.t * walk.freq)) * walk.bob;
      for (const n of walk.bobParts) this.part(n).y += bob;
      if (walk.wobble) this.part(walk.wobble).setRotation(0.08 * Math.sin(time * 2 + e.id));
      if (walk.sway) this.part(walk.sway).setRotation(0.05 * s);
    }
    const tent = this.rig.tentacles;
    if (tent) {
      // Вытягивается в прыжке и сплющивается у земли.
      const lift = (e.baseY - e.y) / Math.max(e.h, 1);
      const stretch = Math.min(lift * 0.12, 0.15);
      const sp = this.part(tent.stretchPart);
      const sb = this.base.get(tent.stretchPart)!.s;
      sp.setScale(sb * (1 - stretch), sb * (1 + stretch));
      tent.names.forEach((n, i) =>
        this.part(n).setRotation(
          (i - 1.5) * 0.12 + (tent.amp + stretch) * Math.sin(time * tent.freq + i * 1.3 + e.id),
        ),
      );
    }
    if (this.rig.armor) {
      this.part(this.rig.armor).setTint(e.hp < 2 ? palette.crackedShade : 0xffffff);
    }
  }

  override update(e: Entity, time: number, heroX: number, heroY: number): void {
    super.update(e, time, heroX, heroY);
    if (this.mound) {
      // Под землёй: только холмик, который ползёт и подрагивает.
      const under = e.burrowed;
      for (const obj of this.root.list) {
        if (obj !== this.mound) (obj as Phaser.GameObjects.Image).setVisible(!under);
      }
      this.mound.setVisible(under).setRotation(under ? 0.06 * Math.sin(time * 14 + e.id) : 0);
      if (under) return;
    }
    // Контейнер отражён по X: направление на героя в локальных координатах.
    const dx = -(heroX - e.x);
    const dy = heroY - e.y;
    const len = Math.hypot(dx, dy) || 1;
    for (const eye of this.eyesOfRig) {
      const p = eye.parent;
      const c = Math.cos(p.rotation);
      const sn = Math.sin(p.rotation);
      const ex = p.x + eye.x * c - eye.y * sn;
      const ey = p.y + eye.x * sn + eye.y * c;
      eye.pupil.setPosition(ex + (dx / len) * eye.range, ey + (dy / len) * eye.range);
    }
  }
}

/** Тварь → риг сгенерированных частей и ключ, по которому видно, что они загрузились. */
const CREATURE_RIGS: Readonly<Record<string, { rig: CreatureRig; key: string }>> = {
  fishman: { rig: fishmanRig, key: 'fish_head' },
  squidling: { rig: squidRig, key: 'squid_mantle' },
  walkingNet: { rig: netRig, key: 'net_body' },
  cultist: { rig: cultistGenRig, key: 'cultist_body' },
  eyeBush: { rig: eyeBushGenRig, key: 'bush_body' },
  firefly: { rig: fireflyGenRig, key: 'firefly_body' },
  rootCrawler: { rig: rootCrawlerGenRig, key: 'root_body' },
  polyp: { rig: polypGenRig, key: 'polyp_stalk' },
  starJelly: { rig: starJellyGenRig, key: 'jelly_bell' },
  wrongCube: { rig: wrongCubeGenRig, key: 'cube_body' },
  deepPriest: { rig: deepPriestGenRig, key: 'priest_body' },
  reefKeeper: { rig: reefKeeperGenRig, key: 'reef_body' },
  rootMother: { rig: rootMotherGenRig, key: 'mother_body' },
  greatSleeper: { rig: greatSleeperGenRig, key: 'sleeper_head' },
};

/** Риги плейсхолдеров M4 (assets-src/rigs/<тварь>.json): твари леса и затонувшего города, боссы. */
const PLACEHOLDER_RIGS: Readonly<Record<string, CreatureRig>> = {
  cultist: cultistRig,
  eyeBush: eyeBushRig,
  firefly: fireflyRig,
  rootCrawler: rootCrawlerRig,
  polyp: polypRig,
  starJelly: starJellyRig,
  wrongCube: wrongCubeRig,
  deepPriest: deepPriestRig,
  reefKeeper: reefKeeperRig,
  rootMother: rootMotherRig,
  greatSleeper: greatSleeperRig,
};

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
    this.legB = unitImage(scene, 'net_leg', -16, -18)
      .setOrigin(0.45, 0.08)
      .setTint(palette.farShade);
    this.legF = unitImage(scene, 'net_leg', 16, -18).setOrigin(0.45, 0.08);
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

  /** key: 'coin' — обычный дублон, 'coin_star' — звёздный (фаза «Звёзды сошлись»). */
  constructor(scene: Phaser.Scene, key: string) {
    this.root = unitImage(scene, key);
    this.unit = unitScale(key);
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

  update(e: Entity, _time: number, heroX: number): void {
    this.root.setPosition(e.x, e.y);
    if (e.hidden && !e.spent) {
      // Рассудок ниже invisibleAt: препятствие проступает только в последний момент.
      const reveal =
        1 - (e.x - heroX - sanityConfig.revealPx * 0.6) / (sanityConfig.revealPx * 0.4);
      this.root.setAlpha(Math.max(0, Math.min(1, reveal)));
    }
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
/** Фонарь, чай или страница книги: покачиваются и светятся. */
class PickupView implements EntityView {
  readonly root: Phaser.GameObjects.Container;
  private readonly img: Phaser.GameObjects.Image;
  private readonly halo: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, type: string) {
    this.root = scene.add.container(0, 0);
    const glowTint = type === 'page' ? palette.sicklyViolet : palette.lanternAmber;
    this.halo = unitImage(scene, 'glow').setTint(glowTint).setBlendMode(Phaser.BlendModes.ADD);
    this.img = unitImage(scene, `pickup_${type}`);
    this.root.add([this.halo, this.img]);
  }

  bind(): void {
    this.root.setVisible(true).setAlpha(1);
  }

  update(e: Entity, time: number): void {
    const bob = Math.sin(time * 2.6 + e.x * 0.01);
    this.root.setPosition(e.x, e.y + bob * 4);
    this.img.setRotation(bob * 0.08);
    this.halo.setScale(unitScale('glow') * (0.55 + 0.06 * Math.sin(time * 5))).setAlpha(0.45);
  }
}

/**
 * Вид твари без привязки к трассе — для дневника (зарисовка) и карточки «Поделиться».
 * Возвращает контейнер, центр которого — центр твари; w×h — её размер в игровых единицах.
 */
export function createCreaturePortrait(
  scene: Phaser.Scene,
  type: string,
  w: number,
  h: number,
): Phaser.GameObjects.Container {
  const e = new Entity();
  e.reset(0, 'enemy', type);
  e.w = w;
  e.h = h;
  const view = createEntityView(scene, e);
  view.bind(e);
  // Взгляд — на зрителя, чуть вниз-влево.
  view.update(e, 0, -w, h);
  const holder = scene.add.container(0, 0, [view.root]);
  return holder;
}

export function createEntityView(scene: Phaser.Scene, e: Entity): EntityView {
  if (e.kind === 'coin') return new CoinView(scene, e.type === 'star' ? 'coin_star' : 'coin');
  if (e.kind === 'pickup') return new PickupView(scene, e.type);
  if (e.kind === 'obstacle') return new ObstacleView(scene, e.type);
  const generated = CREATURE_RIGS[e.type];
  if (generated && isRaster(generated.key)) return new RigCreatureView(scene, generated.rig);
  switch (e.type) {
    case 'fishman':
      return new FishmanView(scene);
    case 'gull':
      return isRaster('gull_body') ? new GeneratedGullView(scene) : new GullView(scene);
    case 'squidling':
      return new SquidView(scene);
    case 'walkingNet':
      return new NetView(scene);
    default: {
      const rig = PLACEHOLDER_RIGS[e.type];
      if (!rig) throw new Error(`Нет представления для врага ${e.type}`);
      return new RigCreatureView(scene, rig);
    }
  }
}

/** Ключ пула: представления одного ключа взаимозаменяемы. */
export function viewKey(e: Entity): string {
  if (e.kind === 'coin') return e.type === 'star' ? 'coin_star' : 'coin';
  return e.kind === 'pickup' ? `pickup_${e.type}` : e.type;
}
