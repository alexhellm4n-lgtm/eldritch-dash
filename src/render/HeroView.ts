import Phaser from 'phaser';
import heroRig from '../../assets-src/rigs/hero.json';
import { juiceConfig } from '../config';
import type { HeroMotor } from '../systems/HeroMotor';
import { CutoutRig } from './CutoutRig';
import { palette } from './palette';
import { unitImage, unitScale } from './textures';

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

  constructor(scene: Phaser.Scene) {
    this.rig = new CutoutRig(scene, heroRig);
    const c = this.rig.container;
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
    this.barBg = scene.add.rectangle(0, -126, barW, 8, palette.outline).setOrigin(0.5);
    this.barFill = scene.add
      .rectangle(-barW / 2 + 2, -126, barW - 4, 4, palette.bioCyan)
      .setOrigin(0, 0.5);
    c.add([this.barBg, this.barFill]);
  }

  get container(): Phaser.GameObjects.Container {
    return this.rig.container;
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

  update(hero: HeroMotor, x: number, dtSec: number): void {
    this.time += dtSec;
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
    let armRot = -0.55;

    if (hero.grounded && !hero.stunned) {
      this.phase += hero.speed * dtSec * STRIDE;
      const s = Math.sin(this.phase);
      legF.setRotation(-0.6 * s);
      legB.setRotation(0.6 * s);
      armRot += 0.25 * Math.sin(this.phase + Math.PI);
      bob = -Math.abs(Math.cos(this.phase)) * 4;
      head.setRotation(0.05 * Math.sin(this.phase * 2));
      wingF.setRotation(0.32 + 0.08 * s);
      wingB.setRotation(0.45 + 0.08 * Math.sin(this.phase + 0.6));
    } else if (!hero.grounded) {
      legF.setRotation(-0.7);
      legB.setRotation(0.35);
      armRot = -1.0;
      if (hero.gliding) {
        const flap = Math.sin(this.time * 16);
        wingF.setRotation(1.85 + 0.22 * flap);
        wingB.setRotation(2.2 + 0.22 * Math.sin(this.time * 16 + 0.5));
        head.setRotation(0.12);
      } else {
        const open = hero.vy < 0 ? 0.9 : 1.2;
        wingF.setRotation(open);
        wingB.setRotation(open + 0.3);
      }
    }

    if (hero.stunned) {
      head.setRotation(0.3 * Math.sin(this.time * 18));
      armRot = 0.2;
      wingF.setRotation(0.2);
      wingB.setRotation(0.3);
    }

    // Удар вспышкой: рука с фонарём резко вперёд и обратно.
    const attackSec = juiceConfig.flashMs / 1000;
    if (this.attackT < attackSec) {
      const k = Math.sin((this.attackT / attackSec) * Math.PI);
      armRot = armRot * (1 - k) - 1.5 * k;
    }
    arm.setRotation(armRot);

    for (const p of this.bobbing) p.y += bob;

    // Фонарь висит на кисти.
    const handLen = heroRig.handLength;
    const lantern = rig.part('lantern');
    const hx = arm.x - Math.sin(armRot) * handLen;
    const hy = arm.y + Math.cos(armRot) * handLen;
    lantern.setPosition(hx, hy).setRotation(0.15 * Math.sin(this.time * 3 + this.phase * 0.5));
    const lanternCx = hx;
    const lanternCy = hy + 22;

    const flicker = 0.42 + 0.06 * Math.sin(this.time * 9) + 0.03 * Math.sin(this.time * 23);
    const glowUnit = unitScale('glow');
    this.glow
      .setPosition(lanternCx, lanternCy)
      .setAlpha(flicker)
      .setScale(1.5 * glowUnit);
    const flashK = Math.max(0, 1 - this.flashT / attackSec);
    this.flash
      .setPosition(lanternCx + 30, lanternCy)
      .setAlpha(flashK * 0.9)
      .setScale((1 + 2.2 * (1 - flashK)) * glowUnit);

    // Звёздочки над головой при оглушении.
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i]!;
      s.setVisible(hero.stunned);
      if (!hero.stunned) continue;
      const a = this.time * 5 + (i * Math.PI * 2) / this.stars.length;
      s.setPosition(8 + Math.cos(a) * 24, -112 + Math.sin(a) * 7).setRotation(a);
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
