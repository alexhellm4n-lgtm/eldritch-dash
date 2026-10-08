import Phaser from 'phaser';
import generatedRig from '../../assets-src/rigs/hero.generated.json';
import placeholderRig from '../../assets-src/rigs/hero.json';
import { juiceConfig } from '../config';
import type { HeroPose } from '../systems/HeroMotor';
import { CutoutRig, type RigDef } from './CutoutRig';
import { palette } from './palette';
import { isRaster, unitImage, unitScale } from './textures';

/** Позы и точки крепления зависят от рисунка частей, поэтому живут в JSON рига. */
interface HeroRigDef extends RigDef {
  /** Плечо → запястье при повороте руки 0, игровые единицы. */
  handOffset: readonly number[];
  /** Запястье → точка хвата (где висит фонарь). */
  gripOffset: readonly number[];
  /** Центр стекла фонаря ниже его точки подвеса. */
  lanternGlowY: number;
  poses: {
    wingFold: readonly number[];
    wingRise: number;
    wingFall: number;
    wingGlide: readonly number[];
    wingStun: readonly number[];
    armRun: number;
    armAir: number;
    armAttack: number;
    armStun: number;
  };
}

/** Сгенерированные части загрузились — их риг, иначе риг SVG-плейсхолдеров. */
function chooseRig(): HeroRigDef {
  return isRaster('hero_head') ? generatedRig : placeholderRig;
}

const STUN_STARS = 3;
/** Шаг фазы бега на пиксель пути (длина шага ~ 2π / STRIDE px). */
const STRIDE = 1 / 24;

/** Отрисовка Эдгара: cut-out риг, свечение фонаря, шкала парения, звёздочки оглушения. */
export class HeroView {
  readonly rig: CutoutRig;
  private readonly glow: Phaser.GameObjects.Image;
  private readonly flash: Phaser.GameObjects.Image;
  private readonly stars: Phaser.GameObjects.Image[] = [];
  private readonly barBg: Phaser.GameObjects.Rectangle;
  private readonly barFill: Phaser.GameObjects.Rectangle;
  private phase = 0;
  private squash = 0;
  private attackT = Infinity;
  private flashT = Infinity;
  private time = 0;
  private readonly bobbing: Phaser.GameObjects.Image[];
  private readonly hand: Phaser.GameObjects.Image | null;
  private readonly def: HeroRigDef;
  private lanternLocalX = 0;
  private lanternLocalY = 0;
  private readonly lanternPos = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene) {
    this.def = chooseRig();
    this.rig = new CutoutRig(scene, this.def);
    const c = this.rig.container;
    this.hand = this.rig.has('hand') ? this.rig.part('hand') : null;
    this.bobbing = ['legFront', 'legBack', 'arm', 'head', 'wingFront', 'wingBack', 'body'].map(
      (n) => this.rig.part(n),
    );

    this.glow = unitImage(scene, 'glow')
      .setTint(palette.lanternAmber)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.45);
    this.flash = unitImage(scene, 'glow')
      .setTint(palette.lanternAmber)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0);
    c.addAt(this.glow, 0);
    c.add(this.flash);

    for (let i = 0; i < STUN_STARS; i++) {
      const s = unitImage(scene, 'stunStar').setVisible(false);
      c.add(s);
      this.stars.push(s);
    }

    const barW = 54;
    this.barBg = scene.add.rectangle(0, -136, barW, 8, palette.outline).setOrigin(0.5);
    this.barFill = scene.add
      .rectangle(-barW / 2 + 2, -136, barW - 4, 4, palette.bioCyan)
      .setOrigin(0, 0.5);
    c.add([this.barBg, this.barFill]);
  }

  get container(): Phaser.GameObjects.Container {
    return this.rig.container;
  }

  /** Центр стекла фонаря в мировых координатах (для выстрела). */
  lanternWorld(): Readonly<{ x: number; y: number }> {
    const c = this.rig.container;
    this.lanternPos.x = c.x + this.lanternLocalX * c.scaleX;
    this.lanternPos.y = c.y + this.lanternLocalY * c.scaleY;
    return this.lanternPos;
  }

  onJump(): void {
    this.squash = -juiceConfig.squash.amount;
  }

  onLand(): void {
    this.squash = juiceConfig.squash.amount;
  }

  onFlash(): void {
    this.attackT = 0;
    this.flashT = 0;
  }

  update(hero: HeroPose, x: number, dtSec: number): void {
    this.time += dtSec;
    const pose = this.def.poses;
    this.attackT += dtSec;
    this.flashT += dtSec;
    const rig = this.rig;
    rig.resetPose();
    const c = rig.container;

    // Squash/stretch: короткий отклик на прыжок и приземление + растяжение от вертикальной скорости.
    const squashMs = this.squash > 0 ? juiceConfig.squash.landMs : juiceConfig.squash.jumpMs;
    this.squash *= Math.max(0, 1 - (dtSec * 1000) / squashMs);
    const stretch = hero.grounded
      ? 0
      : Math.min(Math.abs(hero.vy) * juiceConfig.stretch.perVelocity, juiceConfig.stretch.max);
    const sy = 1 - this.squash + stretch;
    c.setScale(1 / Math.max(sy, 0.5), sy);

    const legF = rig.part('legFront');
    const legB = rig.part('legBack');
    const arm = rig.part('arm');
    const head = rig.part('head');
    const wingF = rig.part('wingFront');
    const wingB = rig.part('wingBack');
    let bob = 0;
    let armRot = pose.armRun;

    if (hero.grounded && !hero.stunned) {
      this.phase += hero.speed * dtSec * STRIDE;
      const s = Math.sin(this.phase);
      legF.setRotation(-0.6 * s);
      legB.setRotation(0.6 * s);
      armRot += 0.25 * Math.sin(this.phase + Math.PI);
      bob = -Math.abs(Math.cos(this.phase)) * 4;
      head.setRotation(0.05 * Math.sin(this.phase * 2));
      wingF.setRotation(pose.wingFold[0]! + 0.08 * s);
      wingB.setRotation(pose.wingFold[1]! + 0.08 * Math.sin(this.phase + 0.6));
    } else if (!hero.grounded) {
      legF.setRotation(-0.7);
      legB.setRotation(0.35);
      armRot = pose.armAir;
      if (hero.gliding) {
        const flap = Math.sin(this.time * 16);
        wingF.setRotation(pose.wingGlide[0]! + 0.22 * flap);
        wingB.setRotation(pose.wingGlide[1]! + 0.22 * Math.sin(this.time * 16 + 0.5));
        head.setRotation(0.12);
      } else {
        const open = hero.vy < 0 ? pose.wingRise : pose.wingFall;
        wingF.setRotation(open);
        wingB.setRotation(open + 0.3);
      }
    }

    if (hero.stunned) {
      head.setRotation(0.3 * Math.sin(this.time * 18));
      armRot = pose.armStun;
      wingF.setRotation(pose.wingStun[0]!);
      wingB.setRotation(pose.wingStun[1]!);
    }

    // Удар вспышкой: рука с фонарём резко вперёд и обратно.
    const attackSec = juiceConfig.flashMs / 1000;
    if (this.attackT < attackSec) {
      const k = Math.sin((this.attackT / attackSec) * Math.PI);
      armRot = armRot * (1 - k) + pose.armAttack * k;
    }
    arm.setRotation(armRot);

    for (const p of this.bobbing) p.y += bob;

    // Кисть — на конце руки, фонарь висит в кисти.
    const [wx, wy] = rotate(this.def.handOffset, armRot);
    const hx = arm.x + wx;
    const hy = arm.y + wy;
    this.hand?.setPosition(hx, hy).setRotation(armRot);
    const [gx, gy] = rotate(this.def.gripOffset, armRot);
    const lantern = rig.part('lantern');
    lantern
      .setPosition(hx + gx, hy + gy)
      .setRotation(0.15 * Math.sin(this.time * 3 + this.phase * 0.5));
    const lanternCx = lantern.x;
    const lanternCy = lantern.y + this.def.lanternGlowY;
    this.lanternLocalX = lanternCx;
    this.lanternLocalY = lanternCy;

    const flicker = 0.42 + 0.06 * Math.sin(this.time * 9) + 0.03 * Math.sin(this.time * 23);
    const glowUnit = unitScale('glow');
    this.glow
      .setPosition(lanternCx, lanternCy)
      .setAlpha(flicker)
      .setScale(1.5 * glowUnit);
    const flashK = Math.max(0, 1 - this.flashT / attackSec);
    this.flash
      .setPosition(lanternCx + 30, lanternCy)
      .setAlpha(flashK * 0.5)
      .setScale((1 + 2.2 * (1 - flashK)) * glowUnit);

    // Звёздочки над головой при оглушении.
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i]!;
      s.setVisible(hero.stunned);
      if (!hero.stunned) continue;
      const a = this.time * 5 + (i * Math.PI * 2) / this.stars.length;
      s.setPosition(6 + Math.cos(a) * 24, -124 + Math.sin(a) * 7).setRotation(a);
    }

    // Шкала парения видна, только когда выносливость не полная.
    const ratio = hero.staminaRatio;
    const showBar = ratio < 0.999;
    this.barBg.setVisible(showBar);
    this.barFill.setVisible(showBar).setScale(Math.max(ratio, 0.001), 1);
    this.barFill.fillColor = ratio < 0.25 ? palette.lanternAmber : palette.bioCyan;

    c.setPosition(x, hero.y);
  }
}

/** Поворот вектора (dx, dy) на угол по часовой стрелке (ось Y вниз, как в Phaser). */
function rotate(v: readonly number[], angle: number): [number, number] {
  const dx = v[0] ?? 0;
  const dy = v[1] ?? 0;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [dx * c - dy * s, dx * s + dy * c];
}
