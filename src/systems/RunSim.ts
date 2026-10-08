import {
  biomesConfig,
  economyConfig,
  enemiesConfig,
  runConfig,
  type BiomeConfig,
  type EconomyConfig,
  type EnemyConfig,
  type RunConfig,
} from '../config';
import { EventBus } from '../core/EventBus';
import { Combat, type HitResult } from './Combat';
import { Combo } from './Combo';
import { EntityPool, overlaps, type Entity, type EntityKind } from './Entity';
import { HeroMotor } from './HeroMotor';
import { Rng } from './Rng';
import { Track } from './Track';

/** События забега. Полезная нагрузка — ссылки на переиспользуемые объекты: не храните их после `despawn`. */
export interface RunEvents {
  spawn: Entity;
  despawn: Entity;
  coin: Entity;
  kill: Entity;
  hurt: Entity;
  flash: undefined;
  /** Номер прыжка в серии: 1 — с земли, 2+ — в воздухе. */
  jump: number;
  land: undefined;
  glideStart: undefined;
  glideEnd: undefined;
  stun: Entity;
  cleared: Entity;
  /** Длина прерванной серии. */
  comboBroken: number;
  /** Сдвиг мира по X (rebase). */
  rebase: number;
}

export interface RunSimOptions {
  seed: number;
  biome?: string;
  run?: RunConfig;
  economy?: EconomyConfig;
  enemies?: Readonly<Record<string, EnemyConfig>>;
  biomes?: Readonly<Record<string, BiomeConfig>>;
}

export interface RunStats {
  jumps: number;
  glideSec: number;
  stuns: number;
  cleared: number;
  kills: number;
  coinsPicked: number;
}

/** Симуляция забега без Phaser: сцена только вызывает press/release/update и рисует состояние. */
export class RunSim {
  readonly bus = new EventBus<RunEvents>();
  readonly hero: HeroMotor;
  readonly combo: Combo;
  readonly combat: Combat;
  readonly entities: Entity[] = [];
  readonly pool = new EntityPool();
  readonly cfg: RunConfig;
  readonly stats: RunStats = {
    jumps: 0,
    glideSec: 0,
    stuns: 0,
    cleared: 0,
    kills: 0,
    coinsPicked: 0,
  };

  /** Дублоны за забег. До M2 (BigNum, экономика) — обычное число. */
  coins = 0;
  /** Пройденная дистанция с учётом всех rebase, px. */
  distancePx = 0;
  time = 0;

  private readonly economy: EconomyConfig;
  private readonly enemyCfg: Readonly<Record<string, EnemyConfig>>;
  private readonly track: Track;
  private safeUntilX: number;
  private readonly onHit = (e: Entity, result: HitResult): void => this.handleHit(e, result);
  private readonly spawnFn = (kind: EntityKind, type: string): Entity => this.spawn(kind, type);

  constructor(opts: RunSimOptions) {
    this.cfg = opts.run ?? runConfig;
    this.economy = opts.economy ?? economyConfig;
    this.enemyCfg = opts.enemies ?? enemiesConfig;
    const biome = (opts.biomes ?? biomesConfig)[opts.biome ?? 'coast'];
    if (!biome) throw new Error(`Неизвестный биом: ${opts.biome}`);

    const { world, hero, glide, attack } = this.cfg;
    this.hero = new HeroMotor(hero, glide, world.groundY);
    this.combo = new Combo(this.economy.combo);
    this.combat = new Combat(attack, hero, this.enemyCfg);
    this.safeUntilX = biome.safeStartPx;
    this.track = new Track(
      biome,
      this.enemyCfg,
      world.groundY,
      this.economy.coin.radius,
      new Rng(opts.seed),
      this.spawnFn,
      hero.screenX,
    );
  }

  get meters(): number {
    return this.distancePx / this.cfg.world.pxPerMeter;
  }

  press(): void {
    this.hero.press();
  }

  release(): void {
    this.hero.release();
  }

  update(rawDt: number): void {
    const dt = Math.min(rawDt, this.cfg.maxStepSec);
    if (dt <= 0) return;
    this.time += dt;

    const hero = this.hero;
    const prevX = hero.x;
    hero.update(dt);
    this.distancePx += hero.x - prevX;
    if (hero.justJumped) {
      this.stats.jumps++;
      this.bus.emit('jump', hero.justJumped);
    }
    if (hero.justLanded) this.bus.emit('land', undefined);
    if (hero.glideStarted) this.bus.emit('glideStart', undefined);
    if (hero.glideEnded) this.bus.emit('glideEnd', undefined);
    if (hero.gliding) this.stats.glideSec += dt;

    this.track.fill(hero.x + this.cfg.world.spawnAheadPx, this.safeUntilX);

    for (let i = 0; i < this.entities.length; i++) this.move(this.entities[i]!, dt);

    if (this.combat.update(dt, hero, this.entities, this.onHit)) this.bus.emit('flash', undefined);

    this.collide(dt);

    if (hero.x > this.cfg.world.rebaseAtPx) this.rebase(-hero.x);
  }

  private move(e: Entity, dt: number): void {
    e.t += dt;
    e.hurtT += dt;
    if (e.kind !== 'enemy') return;
    const cfg = this.enemyCfg[e.type];
    if (!cfg) return;
    switch (cfg.behavior) {
      case 'walker':
        e.x -= cfg.speed * dt;
        break;
      case 'flyer':
        e.x -= cfg.speed * dt;
        e.y = e.baseY + (cfg.bobAmp ?? 0) * Math.sin(2 * Math.PI * (cfg.bobFreq ?? 0) * e.t);
        break;
      case 'hopper': {
        const period = cfg.hopPeriodSec ?? 1;
        e.x -= cfg.speed * dt;
        e.y = e.baseY - (cfg.hopHeight ?? 0) * Math.abs(Math.sin((Math.PI * e.t) / period));
        break;
      }
    }
  }

  private collide(dt: number): void {
    const hero = this.hero;
    const hcfg = this.cfg.hero;
    const hx = hero.x;
    const hy = hero.y - hcfg.height / 2;
    const heroBack = hx - hcfg.width / 2;
    const despawnX = hx - this.cfg.world.despawnBehindPx;

    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i]!;
      let remove = e.x + e.w / 2 < despawnX;

      if (e.kind === 'coin') {
        if (hcfg.magnetRadius > 0 && !e.magnet) {
          const dx = e.x - hx;
          const dy = e.y - hy;
          e.magnet = dx * dx + dy * dy < hcfg.magnetRadius * hcfg.magnetRadius;
        }
        if (e.magnet) {
          const dx = hx - e.x;
          const dy = hy - e.y;
          const len = Math.hypot(dx, dy) || 1;
          const step = Math.min(len, hcfg.magnetSpeed * dt);
          e.x += (dx / len) * step;
          e.y += (dy / len) * step;
        }
        if (overlaps(hx, hy, hcfg.width, hcfg.height, e.x, e.y, e.w, e.h)) {
          e.value = this.economy.coin.baseValue * this.combo.multiplier;
          this.coins += e.value;
          this.stats.coinsPicked++;
          this.bus.emit('coin', e);
          remove = true;
        }
      } else if (e.kind === 'enemy' && e.hp <= 0) {
        remove = true;
      } else if (!e.spent) {
        if (overlaps(hx, hy, hcfg.width, hcfg.height, e.x, e.y, e.w, e.h)) {
          e.spent = true;
          this.stats.stuns++;
          hero.stun(e.kind === 'obstacle' ? hcfg.obstacleStunSec : hcfg.enemyStunSec);
          this.breakCombo();
          this.bus.emit('stun', e);
        } else if (e.kind === 'obstacle' && !e.cleared && e.x + e.w / 2 < heroBack) {
          e.cleared = true;
          this.stats.cleared++;
          this.combo.add(this.economy.combo.streakPerObstacle);
          this.bus.emit('cleared', e);
        }
      }

      if (remove) this.removeAt(i);
    }
  }

  private handleHit(e: Entity, result: HitResult): void {
    if (result === 'hurt') {
      this.bus.emit('hurt', e);
      return;
    }
    const cfg = this.enemyCfg[e.type];
    e.value = (cfg?.coins ?? 0) * this.economy.coin.baseValue * this.combo.multiplier;
    this.coins += e.value;
    this.stats.kills++;
    this.combo.add(this.economy.combo.streakPerKill);
    this.bus.emit('kill', e);
  }

  private breakCombo(): void {
    const streak = this.combo.streak;
    this.combo.reset();
    if (streak > 0) this.bus.emit('comboBroken', streak);
  }

  private spawn(kind: EntityKind, type: string): Entity {
    const e = this.pool.acquire(kind, type);
    this.entities.push(e);
    // Позиция ещё не выставлена: подписчики получают событие в следующем кадре через entities.
    this.bus.emit('spawn', e);
    return e;
  }

  private removeAt(i: number): void {
    const e = this.entities[i]!;
    const last = this.entities.pop()!;
    if (i < this.entities.length) this.entities[i] = last;
    this.bus.emit('despawn', e);
    this.pool.release(e);
  }

  private rebase(dx: number): void {
    this.hero.shift(dx);
    this.track.shift(dx);
    this.safeUntilX += dx;
    for (const e of this.entities) {
      e.x += dx;
    }
    this.bus.emit('rebase', dx);
  }
}
