import {
  biomesConfig,
  catConfig,
  dreamConfig,
  economyConfig,
  enemiesConfig,
  runConfig,
  sanityConfig,
  type BiomeConfig,
  type CatConfig,
  type DreamConfig,
  type EconomyConfig,
  type EnemyConfig,
  type PhaseConfig,
  type RunConfig,
  type RunModifiers,
  type SanityConfig,
} from '../config';
import { bn, ZERO, type Decimal } from '../core/BigNum';
import { EventBus } from '../core/EventBus';
import { Combat, type HitResult } from './Combat';
import { Combo } from './Combo';
import { EntityPool, overlaps, type Entity, type EntityKind } from './Entity';
import { HeroMotor } from './HeroMotor';
import { Rng } from './Rng';
import { Sanity } from './Sanity';
import { Track } from './Track';
import { baseModifiers } from './Upgrades';

/** Сундук с твари или от кота: дублоны и сардинки (SPEC §4.2, §4.7). */
export interface ChestDrop {
  x: number;
  y: number;
  coins: Decimal;
  sardines: number;
}

/** События забега. Полезная нагрузка — ссылки на переиспользуемые объекты: не храните их после `despawn`. */
export interface RunEvents {
  spawn: Entity;
  despawn: Entity;
  coin: Entity;
  kill: Entity;
  hurt: Entity;
  /** Вспышка фонаря; полезная нагрузка — первая задетая тварь. */
  flash: Entity;
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
  /** Подобран фонарь/чай/страница. */
  pickup: Entity;
  /** Собрано страниц в этом цикле. */
  page: number;
  /** Страниц хватает на Сновидение. */
  dreamReady: undefined;
  /** Иллюзия рассеялась от удара или касания. */
  vanish: Entity;
  chest: ChestDrop;
  awakenReady: undefined;
  awakenStart: undefined;
  awakenEnd: undefined;
  /** Рассудок упал до нуля — начинается «Прозрение». */
  insightStart: undefined;
  /** «Прозрение» закончилось: награда. */
  insight: Decimal;
  catCatch: Entity;
  catFetch: Entity;
  catHiss: Entity;
}

export interface RunSimOptions {
  seed: number;
  biome?: string;
  run?: RunConfig;
  economy?: EconomyConfig;
  enemies?: Readonly<Record<string, EnemyConfig>>;
  biomes?: Readonly<Record<string, BiomeConfig>>;
  sanity?: SanityConfig;
  dream?: DreamConfig;
  cat?: CatConfig;
}

export interface RunStats {
  jumps: number;
  glideSec: number;
  stuns: number;
  cleared: number;
  kills: number;
  coinsPicked: number;
  awakenings: number;
  insights: number;
  pages: number;
  illusions: number;
}

const QUIET_PHASE: PhaseConfig = { weight: 1 };

/** Симуляция забега без Phaser: сцена только вызывает press/release/update и рисует состояние. */
export class RunSim {
  readonly bus = new EventBus<RunEvents>();
  readonly hero: HeroMotor;
  readonly combo: Combo;
  readonly combat: Combat;
  readonly sanity: Sanity;
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
    awakenings: 0,
    insights: 0,
    pages: 0,
    illusions: 0,
  };

  /** Номинал одной монеты; выставляет GameSession по CpS и улучшениям. */
  coinValue: Decimal;
  /** Дублоны, заработанные в этом забеге (зачисление в кошелёк — через события). */
  earned: Decimal = ZERO;
  essenceEarned = 0;
  /** Автопрыжок через препятствия (позднее улучшение). */
  autoJump = false;
  magnetRadius: number;
  /** Пройденная дистанция с учётом всех rebase, px. */
  distancePx = 0;
  time = 0;

  /** Шкала Пробуждения 0..1 и остаток его действия, с. */
  awakenMeter = 0;
  awakenLeft = 0;
  /** Полная длительность текущего Пробуждения (для шкалы обратного отсчёта). */
  awakenTotal = 0;
  /** Страницы книги в текущем цикле до Сновидения. */
  pages = 0;
  /** Остаток оглушения «Прозрения», с (0 — не идёт). */
  insightLeft = 0;
  /** Кот-фамильяр открыт (после первого Сновидения). */
  catEnabled = false;
  catTimer = 0;
  phase: PhaseConfig = QUIET_PHASE;

  private mods: RunModifiers = baseModifiers();
  private readonly economy: EconomyConfig;
  private readonly enemyCfg: Readonly<Record<string, EnemyConfig>>;
  private readonly sanityCfg: SanityConfig;
  private readonly dreamCfg: DreamConfig;
  private readonly catCfg: CatConfig;
  private readonly track: Track;
  /** Отдельный генератор для игровых бросков, чтобы раскладка трассы не зависела от них. */
  private readonly luck: Rng;
  private safeUntilX: number;
  private readonly onHit = (e: Entity, result: HitResult): void => this.handleHit(e, result);
  private readonly spawnFn = (kind: EntityKind, type: string): Entity => this.spawn(kind, type);

  constructor(opts: RunSimOptions) {
    this.cfg = opts.run ?? runConfig;
    this.economy = opts.economy ?? economyConfig;
    this.enemyCfg = opts.enemies ?? enemiesConfig;
    this.sanityCfg = opts.sanity ?? sanityConfig;
    this.dreamCfg = opts.dream ?? dreamConfig;
    this.catCfg = opts.cat ?? catConfig;
    const biome = (opts.biomes ?? biomesConfig)[opts.biome ?? 'coast'];
    if (!biome) throw new Error(`Неизвестный биом: ${opts.biome}`);

    const { world, hero, glide, attack } = this.cfg;
    this.hero = new HeroMotor(hero, glide, world.groundY);
    this.combo = new Combo(this.economy.combo);
    this.combat = new Combat(attack, hero, this.enemyCfg);
    this.sanity = new Sanity(this.sanityCfg);
    this.safeUntilX = biome.safeStartPx;
    this.coinValue = bn(this.economy.coin.baseValue);
    this.magnetRadius = hero.magnetRadius;
    this.luck = new Rng(opts.seed ^ 0x5eed);
    this.track = new Track(
      biome,
      this.enemyCfg,
      world.groundY,
      this.economy.coin.radius,
      new Rng(opts.seed),
      this.spawnFn,
      hero.screenX,
    );
    this.applyAll();
  }

  get meters(): number {
    return this.distancePx / this.cfg.world.pxPerMeter;
  }

  get awakening(): boolean {
    return this.awakenLeft > 0;
  }

  /** Итоговый множитель дублонов от рассудка, Пробуждения и фазы. */
  get coinMult(): number {
    const awaken = this.awakening ? this.cfg.awakening.coinMult + this.mods.awakeningCoinMult : 1;
    return this.sanity.coinMult * awaken * (this.phase.coinValueMult ?? 1);
  }

  applyModifiers(m: RunModifiers): void {
    this.mods = m;
    this.applyAll();
  }

  /** Небесная фаза меняет скорость, парение, веса трассы и шансы. */
  setPhase(phase: PhaseConfig): void {
    this.phase = phase;
    this.applyAll();
  }

  private applyAll(): void {
    const m = this.mods;
    const p = this.phase;
    this.hero.applyUpgrades(m.speedBonus, m.extraJumps, m.staminaBonusSec);
    this.hero.targetSpeed *= m.speedMult * (p.speedMult ?? 1);
    this.hero.staminaMax *= p.glideStaminaMult ?? 1;
    this.combat.rangeMult = m.attackRangeMult;
    this.magnetRadius = this.cfg.hero.magnetRadius + m.magnetRadius;
    this.autoJump = m.autoJump > 0;
    this.track.enemyWeightMult = p.enemyWeightMult ?? 1;
    this.track.skyCoinsWeightMult = p.skyCoinsWeightMult ?? 1;
    this.track.pageChance = this.dreamCfg.pageChance * m.pageChanceMult;
  }

  press(): void {
    this.hero.press();
  }

  release(): void {
    this.hero.release();
  }

  /** Запуск Пробуждения по кнопке, когда шкала заполнена. */
  activateAwakening(): boolean {
    if (this.awakenMeter < 1 || this.awakening) return false;
    this.awakenMeter = 0;
    this.awakenLeft = this.cfg.awakening.durationSec * this.mods.awakeningDurationMult;
    this.awakenTotal = this.awakenLeft;
    this.stats.awakenings++;
    this.loseSanity(this.cfg.awakening.sanityCost);
    this.bus.emit('awakenStart', undefined);
    return true;
  }

  update(rawDt: number): void {
    const dt = Math.min(rawDt, this.cfg.maxStepSec);
    if (dt <= 0) return;
    this.time += dt;

    const hero = this.hero;
    if (this.autoJump && hero.grounded && !hero.held) this.autoJumpCheck();
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

    this.updateSanity(dt);

    this.track.fill(hero.x + this.cfg.world.spawnAheadPx, this.safeUntilX);

    for (let i = 0; i < this.entities.length; i++) this.move(this.entities[i]!, dt);

    if (this.awakening) this.updateAwakening(dt);

    if (this.combat.update(dt, hero, this.entities, this.onHit) && this.combat.firstHit) {
      this.bus.emit('flash', this.combat.firstHit);
    }

    if (this.catEnabled) this.updateCat(dt);

    this.collide(dt);

    if (hero.x > this.cfg.world.rebaseAtPx) this.rebase(-hero.x);
  }

  private updateSanity(dt: number): void {
    if (this.insightLeft > 0) {
      this.insightLeft -= dt;
      if (this.insightLeft <= 0) this.finishInsight();
      return;
    }
    const mult = this.mods.sanityDrainMult * (this.phase.sanityDrainMult ?? 1);
    if (this.sanity.drain(dt, mult)) this.startInsight();
  }

  private loseSanity(amount: number): void {
    if (this.insightLeft > 0) return;
    if (this.sanity.lose(amount)) this.startInsight();
  }

  /** Рассудок на нуле: оглушение, затем крупная награда и восстановление (SPEC §4.3). */
  private startInsight(): void {
    const cfg = this.sanityCfg.insight;
    this.insightLeft = cfg.stunSec;
    this.hero.stun(cfg.stunSec);
    this.stats.insights++;
    this.bus.emit('insightStart', undefined);
  }

  private finishInsight(): void {
    const cfg = this.sanityCfg.insight;
    this.insightLeft = 0;
    // Награда считается по множителю «на дне» рассудка — в этом и смысл риска.
    const amount = this.coinValue.mul(cfg.coinUnits * this.coinMult * this.mods.insightRewardMult);
    this.earned = this.earned.add(amount);
    this.sanity.set(cfg.restoreTo);
    this.bus.emit('insight', amount);
  }

  private updateAwakening(dt: number): void {
    const ahead = this.hero.x + this.cfg.awakening.screenAheadPx;
    for (const e of this.entities) {
      if (e.kind !== 'enemy' || e.hp <= 0 || e.x > ahead) continue;
      // Щупальца из-под земли уничтожают всё, что появилось на экране.
      e.hp = 0;
      e.hurtT = 0;
      this.handleHit(e, 'killed');
    }
    this.awakenLeft -= dt;
    if (this.awakenLeft <= 0) {
      this.awakenLeft = 0;
      this.bus.emit('awakenEnd', undefined);
    }
  }

  private updateCat(dt: number): void {
    const cat = this.catCfg;
    const hx = this.hero.x;
    // Кот чует иллюзии и шипит на них — подсказка игроку.
    for (const e of this.entities) {
      if (e.illusion && !e.hissed && e.hp > 0 && e.x - hx > 0 && e.x - hx < cat.hissRangePx) {
        e.hissed = true;
        this.bus.emit('catHiss', e);
      }
    }
    this.catTimer -= dt;
    if (this.catTimer > 0) return;
    this.catTimer = cat.intervalSec * this.mods.catIntervalMult;
    const range = cat.rangePx + this.mods.catRangeBonus;
    const highY = this.cfg.world.groundY - this.cfg.hero.height * 1.5;
    let flyer: Entity | null = null;
    let coin: Entity | null = null;
    for (const e of this.entities) {
      const dx = e.x - hx;
      if (dx < 0 || dx > range) continue;
      if (
        e.kind === 'enemy' &&
        !e.illusion &&
        e.hp > 0 &&
        this.enemyCfg[e.type]?.behavior === 'flyer'
      ) {
        if (!flyer || e.x < flyer.x) flyer = e;
      } else if (e.kind === 'coin' && !e.spent && e.y < highY) {
        if (!coin || e.y < coin.y) coin = e;
      }
    }
    if (flyer) {
      flyer.hp = 0;
      flyer.hurtT = 0;
      this.handleHit(flyer, 'killed');
      this.bus.emit('catCatch', flyer);
      if (this.luck.chance(cat.chestChance + this.mods.chestChanceBonus)) {
        this.dropChest(flyer.x, flyer.y);
      }
    } else if (coin) {
      this.reward(coin, coin.type === 'star' ? (this.phase.starCoinUnits ?? 1) : 1);
      this.stats.coinsPicked++;
      this.bus.emit('catFetch', coin);
      // Монету «приносит» кот: убираем её с трассы в общем цикле столкновений.
      coin.spent = true;
    }
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
        if (e.spent) {
          remove = true;
        } else {
          if (this.magnetRadius > 0 && !e.magnet) {
            const dx = e.x - hx;
            const dy = e.y - hy;
            e.magnet = dx * dx + dy * dy < this.magnetRadius * this.magnetRadius;
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
            this.reward(e, e.type === 'star' ? (this.phase.starCoinUnits ?? 1) : 1);
            this.stats.coinsPicked++;
            this.bus.emit('coin', e);
            remove = true;
          }
        }
      } else if (e.kind === 'pickup') {
        if (overlaps(hx, hy, hcfg.width, hcfg.height, e.x, e.y, e.w, e.h)) {
          this.pickUp(e);
          remove = true;
        }
      } else if (e.kind === 'enemy' && e.hp <= 0) {
        remove = true;
      } else if (!e.spent) {
        if (overlaps(hx, hy, hcfg.width, hcfg.height, e.x, e.y, e.w, e.h)) {
          e.spent = true;
          if (e.illusion) {
            // Иллюзия безвредна: проходит сквозь героя и рассеивается.
            e.hp = 0;
            this.bus.emit('vanish', e);
          } else {
            this.stats.stuns++;
            hero.stun(e.kind === 'obstacle' ? hcfg.obstacleStunSec : hcfg.enemyStunSec);
            this.breakCombo();
            this.bus.emit('stun', e);
            if (e.kind === 'enemy') {
              this.loseSanity(this.sanityCfg.contactLoss * this.mods.contactLossMult);
            }
          }
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

  /** Засчитать страницу книги (подбор с трассы или выдача). */
  grantPage(): void {
    this.pages++;
    this.stats.pages++;
    this.bus.emit('page', this.pages);
    if (this.pages >= this.dreamCfg.pagesNeeded) {
      this.pages = 0;
      this.bus.emit('dreamReady', undefined);
    }
  }

  private pickUp(e: Entity): void {
    if (e.type === 'page') {
      this.grantPage();
    } else if (this.insightLeft <= 0) {
      const amount = this.sanityCfg.pickups[e.type] ?? 0;
      this.sanity.restore(amount * this.mods.sanityPickupMult);
    }
    this.bus.emit('pickup', e);
  }

  private handleHit(e: Entity, result: HitResult): void {
    if (e.illusion) {
      // Иллюзия неотличима до удара: исчезает без награды и без серии.
      e.hp = 0;
      this.stats.illusions++;
      this.bus.emit('vanish', e);
      return;
    }
    if (result === 'hurt') {
      this.bus.emit('hurt', e);
      return;
    }
    const cfg = this.enemyCfg[e.type];
    this.reward(e, cfg?.coins ?? 0);
    e.essence = (cfg?.essence ?? 0) * this.mods.essenceMult * (this.phase.essenceMult ?? 1);
    this.essenceEarned += e.essence;
    this.stats.kills++;
    this.combo.add(this.economy.combo.streakPerKill);
    if (!this.awakening && this.awakenMeter < 1) {
      const kills = this.cfg.awakening.killsToFill * this.mods.awakeningKillsMult;
      this.awakenMeter = Math.min(1, this.awakenMeter + 1 / Math.max(1, kills));
      if (this.awakenMeter >= 1) this.bus.emit('awakenReady', undefined);
    }
    this.bus.emit('kill', e);
    if (this.luck.chance((cfg?.chestChance ?? 0) + this.mods.chestChanceBonus)) {
      this.dropChest(e.x, e.y);
    }
  }

  private dropChest(x: number, y: number): void {
    const c = this.economy.chest;
    const coins = this.coinValue.mul(c.coinUnits * this.coinMult);
    this.earned = this.earned.add(coins);
    const sardines = Math.round(this.luck.int(c.sardines) * this.mods.sardineMult);
    this.bus.emit('chest', { x, y, coins, sardines });
  }

  /** Награда = номинал × единицы × серия × рассудок × Пробуждение × фаза. */
  private reward(e: Entity, units: number): void {
    e.reward = this.coinValue.mul(units * this.combo.multiplier * this.coinMult);
    this.earned = this.earned.add(e.reward);
  }

  private autoJumpCheck(): void {
    const front = this.hero.x + this.cfg.hero.width / 2;
    for (const e of this.entities) {
      if (e.kind !== 'obstacle' || e.spent) continue;
      const dist = e.x - e.w / 2 - front;
      if (dist > 0 && dist < this.cfg.hero.autoJumpLookaheadPx) {
        this.hero.press();
        this.hero.release();
        return;
      }
    }
  }

  private breakCombo(): void {
    const streak = this.combo.streak;
    this.combo.reset();
    if (streak > 0) this.bus.emit('comboBroken', streak);
  }

  private spawn(kind: EntityKind, type: string): Entity {
    const e = this.pool.acquire(kind, type);
    const s = this.sanityCfg;
    if (kind === 'enemy' && this.sanity.distorted) {
      // Чем ниже рассудок, тем больше иллюзий среди тварей.
      e.illusion = this.luck.chance(s.illusionChance * this.sanity.distortion);
    } else if (kind === 'obstacle' && this.sanity.hidesObstacles) {
      e.hidden = this.luck.chance(s.hiddenChance);
    } else if (kind === 'coin' && this.luck.chance(this.phase.starCoinChance ?? 0)) {
      e.type = 'star';
    }
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
