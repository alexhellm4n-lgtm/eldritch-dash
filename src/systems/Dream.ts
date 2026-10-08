import type { DreamConfig } from '../config/types';
import { EventBus } from '../core/EventBus';
import type { HeroPose } from './HeroMotor';
import { Rng } from './Rng';

export type DreamObjKind = 'coin' | 'ring' | 'island';

export interface DreamObj {
  kind: DreamObjKind;
  x: number;
  y: number;
  taken: boolean;
  /** Время жизни для анимации, с. */
  t: number;
}

export interface DreamEvents {
  coin: DreamObj;
  ring: DreamObj;
  /** true — тап попал в зелёную зону ритма (ускорение). */
  tap: boolean;
  end: undefined;
}

/** Радиус сбора монеты во сне. */
const COIN_REACH = 34;
const HERO_SCREEN_X = 300;

/**
 * «Сновидение» (SPEC §4.6): 30 секунд полёта без земли. Тап — взмах крыльями;
 * тап в зелёной зоне ритм-индикатора даёт ускорение. Награда — от монет и пройденных колец.
 */
export class DreamSim implements HeroPose {
  readonly bus = new EventBus<DreamEvents>();
  readonly objects: DreamObj[] = [];
  x = 0;
  y: number;
  vy = 0;
  speed: number;
  readonly grounded = false;
  readonly gliding = true;
  readonly stunned = false;
  readonly staminaRatio = 1;
  time = 0;
  coins = 0;
  rings = 0;
  perfectTaps = 0;
  finished = false;

  private boost = 0;
  private nextRingX: number;
  private nextCoinX: number;
  private nextIslandX: number;
  private readonly rng: Rng;

  constructor(
    private readonly cfg: DreamConfig,
    seed: number,
  ) {
    this.rng = new Rng(seed);
    this.y = (cfg.ceilingY + cfg.floorY) / 2;
    this.speed = cfg.baseSpeed;
    this.nextRingX = 700;
    this.nextCoinX = 450;
    this.nextIslandX = 300;
  }

  get timeLeft(): number {
    return Math.max(0, this.cfg.durationSec - this.time);
  }

  /** Фаза ритм-индикатора 0..1. */
  get rhythm(): number {
    return (this.time / this.cfg.rhythm.periodSec) % 1;
  }

  get inGreen(): boolean {
    const r = this.rhythm;
    return r >= this.cfg.rhythm.greenFrom && r <= this.cfg.rhythm.greenTo;
  }

  get points(): number {
    const r = this.cfg.reward;
    return this.coins * r.coinWeight + this.rings * r.ringWeight;
  }

  tap(): void {
    if (this.finished) return;
    this.vy = -this.cfg.flapVelocity;
    const perfect = this.inGreen;
    if (perfect) {
      this.boost += this.cfg.boostSpeed;
      this.perfectTaps++;
    }
    this.bus.emit('tap', perfect);
  }

  update(dt: number): void {
    if (this.finished || dt <= 0) return;
    const c = this.cfg;
    this.time += dt;
    this.vy = Math.min(this.vy + c.gravity * dt, c.maxFall);
    this.y += this.vy * dt;
    if (this.y < c.ceilingY) {
      this.y = c.ceilingY;
      this.vy = Math.max(0, this.vy);
    }
    if (this.y > c.floorY) {
      this.y = c.floorY;
      this.vy = Math.min(0, this.vy);
    }
    this.boost *= Math.max(0, 1 - c.boostDecayPerSec * dt);
    this.speed = c.baseSpeed + this.boost;
    this.x += this.speed * dt;

    this.spawnAhead(this.x + 1600);
    this.collide();

    if (this.time >= c.durationSec) {
      this.finished = true;
      this.bus.emit('end', undefined);
    }
  }

  private spawnAhead(until: number): void {
    const c = this.cfg;
    while (this.nextRingX < until) {
      this.objects.push({
        kind: 'ring',
        x: this.nextRingX,
        y: this.rng.range(c.ringHeightRange),
        taken: false,
        t: 0,
      });
      this.nextRingX += this.rng.range(c.ringEveryPx);
    }
    while (this.nextCoinX < until) {
      const n = this.rng.int(c.coinsPerLine);
      const y0 = this.rng.range(c.ringHeightRange);
      const slope = this.rng.range([-30, 30]);
      for (let i = 0; i < n; i++) {
        this.objects.push({
          kind: 'coin',
          x: this.nextCoinX + i * c.coinSpacing,
          y: y0 + slope * i,
          taken: false,
          t: 0,
        });
      }
      this.nextCoinX += n * c.coinSpacing + this.rng.range(c.coinLineEveryPx);
    }
    while (this.nextIslandX < until) {
      this.objects.push({
        kind: 'island',
        x: this.nextIslandX,
        y: this.rng.range(c.ringHeightRange),
        taken: false,
        t: 0,
      });
      this.nextIslandX += this.rng.range(c.islandEveryPx);
    }
  }

  private collide(): void {
    const behind = this.x - HERO_SCREEN_X - 200;
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i]!;
      if (!o.taken) {
        if (o.kind === 'coin' && Math.hypot(o.x - this.x, o.y - this.y) < COIN_REACH) {
          o.taken = true;
          this.coins++;
          this.bus.emit('coin', o);
        } else if (
          o.kind === 'ring' &&
          this.x >= o.x &&
          Math.abs(this.y - o.y) < this.cfg.ringGap / 2
        ) {
          o.taken = true;
          this.rings++;
          this.bus.emit('ring', o);
        }
      }
      if (o.x < behind) this.objects.splice(i, 1);
    }
  }
}
