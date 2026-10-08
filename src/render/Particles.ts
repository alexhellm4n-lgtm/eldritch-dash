import Phaser from 'phaser';
import { juiceConfig } from '../config';
import { Depth } from './Parallax';
import { palette } from './palette';
import { isRaster, unitScale } from './textures';

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

/** Набор эмиттеров-«взрывов»: частицы создаются пулом внутри эмиттеров Phaser. */
export class Particles {
  private readonly coin: Emitter;
  private readonly poof: Emitter;
  private readonly drops: Emitter;
  private readonly dust: Emitter;
  private readonly all: Emitter[];

  constructor(scene: Phaser.Scene) {
    const u = (key: string): number => unitScale(key);
    this.coin = scene.add.particles(0, 0, 'spark', {
      emitting: false,
      speed: { min: 80, max: 220 },
      angle: { min: 200, max: 340 },
      gravityY: 400,
      lifespan: 420,
      scale: { start: u('spark') * 1.2, end: 0 },
      rotate: { min: 0, max: 360 },
      blendMode: Phaser.BlendModes.ADD,
    });
    this.poof = scene.add.particles(0, 0, 'puff', {
      emitting: false,
      speed: { min: 60, max: 200 },
      lifespan: 520,
      scale: { start: u('puff') * 1.1, end: u('puff') * 0.2 },
      alpha: { start: 1, end: 0 },
      // Сгенерированный дым уже фиолетовый — лишь слегка разнообразим; плейсхолдер белый — красим.
      tint: isRaster('puff')
        ? [0xffffff, palette.puffTintCool, palette.puffTintWarm]
        : [palette.sicklyViolet, palette.bioCyan, palette.coral],
    });
    this.drops = scene.add.particles(0, 0, 'drop', {
      emitting: false,
      speed: { min: 160, max: 340 },
      angle: { min: 220, max: 320 },
      gravityY: 1100,
      lifespan: 650,
      scale: { start: u('drop'), end: u('drop') * 0.5 },
    });
    this.dust = scene.add.particles(0, 0, 'dust', {
      emitting: false,
      speedX: { min: -140, max: -20 },
      speedY: { min: -70, max: -10 },
      lifespan: 380,
      scale: { start: u('dust'), end: u('dust') * 1.8 },
      alpha: { start: 0.8, end: 0 },
    });
    this.all = [this.coin, this.poof, this.drops, this.dust];
    for (const e of this.all) e.setDepth(Depth.fx);
  }

  coinBurst(x: number, y: number): void {
    this.coin.explode(juiceConfig.particles.coin, x, y);
  }

  /** «Булькающий плюх» при гибели твари. */
  splat(x: number, y: number): void {
    this.poof.explode(juiceConfig.particles.kill, x, y);
    this.drops.explode(juiceConfig.particles.drops, x, y);
  }

  dustPuff(x: number, y: number): void {
    this.dust.explode(juiceConfig.particles.dust, x, y);
  }

  /** Сдвиг живых частиц при rebase мира. */
  shift(dx: number): void {
    for (const e of this.all) e.forEachAlive((p) => (p.x += dx), this);
  }
}
