import {
  biomesConfig,
  catConfig,
  dreamConfig,
  economyConfig,
  enemiesConfig,
  progressionConfig,
  runConfig,
  sanityConfig,
  type BiomeConfig,
  type BossConfig,
  type CatConfig,
  type DreamConfig,
  type EconomyConfig,
  type EnemyConfig,
  type PhaseConfig,
  type ProgressionConfig,
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
import { placeEnemy, Track } from './Track';
import { baseModifiers } from './Upgrades';

/** Сундук с твари или от кота: дублоны и сардинки (SPEC §4.2, §4.7). */
export interface ChestDrop {
  x: number;
  y: number;
  coins: Decimal;
  sardines: number;
}

/** Победа над боссом биома: награда уже посчитана и зачисляется сессией. */
export interface BossDefeat {
  id: string;
  x: number;
  y: number;
  coins: Decimal;
  essence: number;
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
  /** Появился мини-босс. */
  eliteSpawn: Entity;
  /** «Крот» вылез из-под земли. */
  emerge: Entity;
  bossSpawn: Entity;
  /** Босс атакует: волна или призыв (для анимации). */
  bossAttack: Entity;
  /** Босса не успели победить — он уходит, путь откатывается. */
  bossEscaped: Entity;
  bossDefeated: BossDefeat;
  /** Начался новый биом (id). */
  biomeChange: string;
}

export interface RunSimOptions {
  seed: number;
  biome?: string;
  /** Пройдено в биоме, м, и номер круга — из сохранения. */
  progressM?: number;
  lap?: number;
  run?: RunConfig;
  economy?: EconomyConfig;
  enemies?: Readonly<Record<string, EnemyConfig>>;
  biomes?: Readonly<Record<string, BiomeConfig>>;
  sanity?: SanityConfig;
  dream?: DreamConfig;
  cat?: CatConfig;
  progression?: ProgressionConfig;
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
  miniBossKills: number;
  bossKills: number;
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
    miniBossKills: 0,
    bossKills: 0,
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

  biomeId: string;
  biome: BiomeConfig;
  /** Пройдено в текущем биоме, м; на длине биома появляется босс. */
  biomeProgressM: number;
  /** Круг по биомам (после финального босса — заново, сложнее и щедрее). */
  lap: number;
  /** Текущий босс (null — боя нет). */
  boss: Entity | null = null;
  bossCfg: BossConfig | null = null;
  bossMaxHp = 0;
  /** Время боя с боссом, с. */
  bossTime = 0;
  /** Босс побеждён — до смены биома, с. */
  transitionLeft = 0;

  private mods: RunModifiers = baseModifiers();
  private readonly economy: EconomyConfig;
  private readonly enemyCfg: Readonly<Record<string, EnemyConfig>>;
  private readonly sanityCfg: SanityConfig;
  private readonly dreamCfg: DreamConfig;
  private readonly catCfg: CatConfig;
  private readonly biomes: Readonly<Record<string, BiomeConfig>>;
  private readonly progression: ProgressionConfig;
  private track: Track;
  private readonly trackRng: Rng;
  private nextEliteM: number;
  private bossAttackTimer = 0;
  private bossAttackIdx = 0;
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
    this.progression = opts.progression ?? progressionConfig;
    this.biomes = opts.biomes ?? biomesConfig;
    this.biomeId = opts.biome ?? 'coast';
    const biome = this.biomes[this.biomeId];
    if (!biome) throw new Error(`Неизвестный биом: ${opts.biome}`);
    this.biome = biome;
    this.biomeProgressM = opts.progressM ?? 0;
    this.lap = opts.lap ?? 0;
    const every = biome.miniBoss.everyM;
    this.nextEliteM = (Math.floor(this.biomeProgressM / every) + 1) * every;

    const { world, hero, glide, attack } = this.cfg;
    this.hero = new HeroMotor(hero, glide, world.groundY);
    this.combo = new Combo(this.economy.combo);
    this.combat = new Combat(attack, hero, this.enemyCfg);
    this.sanity = new Sanity(this.sanityCfg);
    this.safeUntilX = biome.safeStartPx;
    this.coinValue = bn(this.economy.coin.baseValue);
    this.magnetRadius = hero.magnetRadius;
    this.luck = new Rng(opts.seed ^ 0x5eed);
    this.trackRng = new Rng(opts.seed);
    this.track = this.makeTrack(biome, hero.screenX);
    this.applyAll();
  }

  get meters(): number {
    return this.distancePx / this.cfg.world.pxPerMeter;
  }

  private makeTrack(biome: BiomeConfig, startX: number): Track {
    return new Track(
      biome,
      this.enemyCfg,
      this.cfg.world.groundY,
      this.economy.coin.radius,
      this.trackRng,
      this.spawnFn,
      startX,
    );
  }

  get awakening(): boolean {
    return this.awakenLeft > 0;
  }

  /** Итоговый множитель дублонов от рассудка, Пробуждения и фазы. */
  get coinMult(): number {
    const awaken = this.awakening ? this.cfg.awakening.coinMult + this.mods.awakeningCoinMult : 1;
    const world = this.biome.coinMult * (1 + this.progression.lap.coinMult * this.lap);
    return this.sanity.coinMult * awaken * (this.phase.coinValueMult ?? 1) * world;
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
    this.combat.eliteKnockback = this.biome.miniBoss.knockback;
    this.magnetRadius = this.cfg.hero.magnetRadius + m.magnetRadius;
    this.autoJump = m.autoJump > 0;
    this.track.enemyWeightMult = p.enemyWeightMult ?? 1;
    this.track.skyCoinsWeightMult = p.skyCoinsWeightMult ?? 1;
    this.track.pageChance = this.dreamCfg.pageChance * m.pageChanceMult;
    this.track.calm = this.boss !== null || this.transitionLeft > 0;
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
    if (!this.boss && this.transitionLeft <= 0) {
      this.biomeProgressM += (hero.x - prevX) / this.cfg.world.pxPerMeter;
    }
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
    this.updateProgress(dt);

    for (let i = 0; i < this.entities.length; i++) this.move(this.entities[i]!, dt);

    if (this.boss) this.updateBoss(dt);
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
      if (e.kind !== 'enemy' || e.boss || e.hp <= 0 || e.x > ahead) continue;
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
    e.x += e.vx * dt;
    if (e.kind !== 'enemy') return;
    if (e.boss) {
      // Не успели победить: босс обгоняет героя и исчезает за краем.
      if (e.leaving) e.x += (this.hero.speed + this.progression.bossLeaveSpeed) * dt;
      return;
    }
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
      case 'burrower':
        if (e.burrowed) {
          e.x -= (cfg.burrowSpeed ?? cfg.speed) * dt;
          if (e.x - this.hero.x < (cfg.emergePx ?? 0)) {
            e.burrowed = false;
            this.bus.emit('emerge', e);
          }
        } else {
          e.x -= cfg.speed * dt;
        }
        break;
      case 'blinker': {
        // Перескакивает между землёй и высотой: прыгать или ждать.
        e.x -= cfg.speed * dt;
        const up = Math.floor(e.t / (cfg.blinkPeriodSec ?? 1)) % 2 === 1;
        const target = up ? this.cfg.world.groundY - (cfg.altitude ?? 0) : e.baseY;
        e.y += (target - e.y) * Math.min(1, dt * (cfg.blinkSnapPerSec ?? 1));
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
      } else if (e.boss) {
        // Босс не толкается: опасны его волны и призванные твари.
        remove = e.leaving && e.x > hx + this.cfg.world.spawnAheadPx;
      } else if (e.burrowed) {
        // Под землёй безвреден.
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
    if (e.boss) {
      this.defeatBoss(e);
      return;
    }
    const cfg = this.enemyCfg[e.type];
    const mb = this.biome.miniBoss;
    this.reward(e, (cfg?.coins ?? 0) * (e.elite ? mb.rewardMult : 1));
    e.essence =
      (cfg?.essence ?? 0) *
      (e.elite ? mb.essenceMult : 1) *
      this.mods.essenceMult *
      (this.phase.essenceMult ?? 1);
    if (e.elite) this.stats.miniBossKills++;
    this.essenceEarned += e.essence;
    this.stats.kills++;
    this.combo.add(this.economy.combo.streakPerKill);
    if (!this.awakening && this.awakenMeter < 1) {
      const kills = this.cfg.awakening.killsToFill * this.mods.awakeningKillsMult;
      this.awakenMeter = Math.min(1, this.awakenMeter + 1 / Math.max(1, kills));
      if (this.awakenMeter >= 1) this.bus.emit('awakenReady', undefined);
    }
    this.bus.emit('kill', e);
    // Мини-босс всегда оставляет сундук.
    if (e.elite || this.luck.chance((cfg?.chestChance ?? 0) + this.mods.chestChanceBonus)) {
      this.dropChest(e.x, e.y);
    }
  }

  /** Путь по биому: мини-боссы через каждые everyM, босс — в конце биома. */
  private updateProgress(dt: number): void {
    if (this.transitionLeft > 0) {
      this.transitionLeft -= dt;
      if (this.transitionLeft <= 0) this.enterNextBiome();
      return;
    }
    if (this.boss) return;
    const biome = this.biome;
    if (this.biomeProgressM >= biome.lengthM) {
      // Босс не выходит, пока идёт стартовый безопасный отрезок.
      if (this.hero.x > this.safeUntilX) this.spawnBoss();
      return;
    }
    const mb = biome.miniBoss;
    if (this.biomeProgressM < this.nextEliteM) return;
    this.nextEliteM += mb.everyM;
    const chance = Math.min(1, mb.chance * (this.phase.miniBossChanceMult ?? 1));
    // Перед самым боссом мини-боссов нет.
    if (this.biomeProgressM > biome.lengthM - mb.everyM / 2 || !this.luck.chance(chance)) return;
    const e = this.track.spawnElite(mb);
    e.illusion = false;
    this.bus.emit('eliteSpawn', e);
  }

  private spawnBoss(): void {
    const cfg = this.progression.bosses[this.biome.boss];
    if (!cfg) return;
    const e = this.pool.acquire('enemy', this.biome.boss);
    e.boss = true;
    e.w = cfg.width;
    e.h = cfg.height;
    e.hp = this.bossMaxHp = Math.ceil(cfg.hp * (1 + this.progression.lap.hpMult * this.lap));
    e.x = this.hero.x + this.cfg.world.spawnAheadPx;
    e.y = e.baseY = this.cfg.world.groundY - (cfg.altitude > 0 ? cfg.altitude : cfg.height / 2);
    this.entities.push(e);
    this.bus.emit('spawn', e);
    this.boss = e;
    this.bossCfg = cfg;
    this.bossTime = 0;
    this.bossAttackTimer = cfg.attackEverySec;
    this.bossAttackIdx = 0;
    this.track.calm = true;
    this.bus.emit('bossSpawn', e);
  }

  /** Отладка: мини-босс прямо сейчас (впереди на трассе). */
  spawnEliteNow(): void {
    const e = this.track.spawnElite(this.biome.miniBoss);
    e.illusion = false;
    this.bus.emit('eliteSpawn', e);
  }

  /** Насколько босс сейчас подлетел к герою: 0 — держится на holdPx, 1 — в зоне вспышки. */
  bossExposure(): number {
    const cfg = this.bossCfg;
    if (!cfg) return 0;
    const t = this.bossTime - this.progression.bossEntrySec;
    if (t < 0) return 0;
    const c = t % cfg.cycleSec;
    const a = cfg.approachSec;
    const ease = (k: number): number => k * k * (3 - 2 * k);
    if (c < a) return ease(c / a);
    if (c < a + cfg.exposeSec) return 1;
    if (c < 2 * a + cfg.exposeSec) return 1 - ease((c - a - cfg.exposeSec) / a);
    return 0;
  }

  private updateBoss(dt: number): void {
    const e = this.boss!;
    const cfg = this.bossCfg!;
    this.bossTime += dt;
    const ahead = this.cfg.world.spawnAheadPx;
    const entry = Math.min(1, this.bossTime / this.progression.bossEntrySec);
    const exposure = this.bossExposure();
    const hold = cfg.holdPx - (cfg.holdPx - cfg.exposePx) * exposure;
    // Выход из-за правого края, затем — на своей дистанции от героя.
    e.x = this.hero.x + ahead + (hold - ahead) * entry;
    e.y = e.baseY + Math.sin(this.bossTime * 1.6) * this.progression.bossBobPx;

    if (this.bossTime >= cfg.fightSec) {
      this.escapeBoss(e, cfg);
      return;
    }
    if (entry < 1 || exposure > 0) return;
    this.bossAttackTimer -= dt;
    if (this.bossAttackTimer > 0) return;
    this.bossAttackTimer = cfg.attackEverySec;
    const attack = cfg.attacks[this.bossAttackIdx++ % cfg.attacks.length];
    if (attack === 'wave') this.bossWave(e, cfg);
    else this.bossSummon(e, cfg);
    this.bus.emit('bossAttack', e);
  }

  /** Волна по земле: препятствие, которое летит к герою, — перепрыгнуть. */
  private bossWave(boss: Entity, cfg: BossConfig): void {
    const w = cfg.wave;
    const e = this.spawn('obstacle', w.key);
    e.hidden = false;
    e.w = w.width;
    e.h = w.height;
    e.x = boss.x - boss.w / 2;
    e.y = e.baseY = this.cfg.world.groundY - w.height / 2;
    e.vx = -w.speed;
  }

  private bossSummon(boss: Entity, cfg: BossConfig): void {
    const type = cfg.summon[this.luck.int([0, cfg.summon.length - 1])];
    const ecfg = type ? this.enemyCfg[type] : undefined;
    if (!type || !ecfg) return;
    const x = boss.x - boss.w / 2 - ecfg.width;
    placeEnemy(this.spawn('enemy', type), ecfg, x, this.cfg.world.groundY);
  }

  private escapeBoss(e: Entity, cfg: BossConfig): void {
    e.leaving = true;
    this.boss = null;
    this.bossCfg = null;
    this.biomeProgressM = this.biome.lengthM * cfg.retreatTo;
    const every = this.biome.miniBoss.everyM;
    this.nextEliteM = (Math.floor(this.biomeProgressM / every) + 1) * every;
    this.track.calm = false;
    this.bus.emit('bossEscaped', e);
  }

  private defeatBoss(e: Entity): void {
    const cfg = this.bossCfg;
    this.boss = null;
    this.bossCfg = null;
    this.stats.bossKills++;
    if (!cfg) return;
    const mult = 1 + this.progression.lap.rewardMult * this.lap;
    e.reward = this.coinValue.mul(cfg.coins * this.coinMult * mult);
    this.earned = this.earned.add(e.reward);
    e.essence = cfg.essence * this.mods.essenceMult * mult;
    this.essenceEarned += e.essence;
    const sardines = Math.round(cfg.sardines * this.mods.sardineMult * mult);
    this.transitionLeft = this.progression.transitionSec;
    this.bus.emit('bossDefeated', {
      id: e.type,
      x: e.x,
      y: e.y,
      coins: e.reward,
      essence: e.essence,
      sardines,
    });
  }

  /** Следующий биом по порядку; после последнего — новый круг. */
  private enterNextBiome(): void {
    const order = this.progression.order;
    const i = order.indexOf(this.biomeId);
    if (i + 1 >= order.length) this.lap++;
    this.setBiome(order[(i + 1) % order.length] ?? order[0]!);
  }

  /** Смена биома прямо в забеге: новая трасса продолжается с текущего курсора. */
  setBiome(id: string): void {
    const biome = this.biomes[id];
    if (!biome) throw new Error(`Неизвестный биом: ${id}`);
    this.biomeId = id;
    this.biome = biome;
    this.biomeProgressM = 0;
    this.nextEliteM = biome.miniBoss.everyM;
    this.transitionLeft = 0;
    this.track = this.makeTrack(biome, this.track.cursor);
    this.safeUntilX = this.track.cursor + biome.safeStartPx;
    this.applyAll();
    this.bus.emit('biomeChange', id);
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
