import {
  achievementsConfig,
  catConfig,
  dreamConfig,
  economyConfig,
  enemiesConfig,
  grimoireConfig,
  journalConfig,
  newspaperConfig,
  sanityConfig,
  starsConfig,
  townConfig,
  upgradesConfig,
  type AchievementsConfig,
  type CatConfig,
  type DreamConfig,
  type EconomyConfig,
  type GrimoireConfig,
  type JournalConfig,
  type NewspaperConfig,
  type OmenConfig,
  type RunModifiers,
  type SanityConfig,
  type StarsConfig,
  type TownConfig,
  type UpgradesConfig,
} from '../config';
import { bn, type Decimal } from '../core/BigNum';
import { EventBus } from '../core/EventBus';
import { createWorldState, type GameState, type TutorialState } from '../core/GameState';
import { Achievements, type AchievementDef } from './Achievements';
import { Economy, type BuyAmount } from './Economy';
import { Grimoire } from './Grimoire';
import { HintWatcher, type HintId } from './Hints';
import { Journal } from './Journal';
import { Newspaper, type Issue } from './Newspaper';
import { computeOffline, type OfflineReport } from './Offline';
import { canDive, darkStarsFor, omenChoices, starMultiplier } from './Prestige';
import type { RunSim } from './RunSim';
import { coinMultFor } from './Sanity';
import { Stars, type PhaseInfo } from './Stars';
import { Town } from './Town';
import { applyEffect, baseModifiers, Upgrades } from './Upgrades';

export interface SessionEvents {
  purchase: { kind: 'item' | 'hero' | 'grimoire' | 'cat' | 'town'; id: string };
  offline: OfflineReport;
  tutorial: keyof TutorialState;
  /** Сменилась небесная фаза. */
  phase: PhaseInfo;
  catUnlocked: undefined;
  /** Совершено Погружение: новая глубина. */
  dive: number;
  achievement: AchievementDef;
  /** Первая встреча с тварью — новая карточка в дневнике. */
  journalNew: string;
  /** Запись в дневнике стала полной. */
  journalFull: string;
}

export interface ItemQuote {
  count: number;
  cost: Decimal;
  affordable: boolean;
}

export interface DreamReward {
  coins: Decimal;
  sardines: number;
}

export interface SessionConfigs {
  upgrades?: UpgradesConfig;
  economy?: EconomyConfig;
  grimoire?: GrimoireConfig;
  stars?: StarsConfig;
  cat?: CatConfig;
  sanity?: SanityConfig;
  dream?: DreamConfig;
  town?: TownConfig;
  journal?: JournalConfig;
  achievements?: AchievementsConfig;
  newspaper?: NewspaperConfig;
}

/** Как часто опрашивать подсказки и проверять достижения, с. */
const HINT_POLL_SEC = 0.5;
const ACHIEVEMENT_CHECK_SEC = 1;

/**
 * Игровая сессия: владеет GameState, считает бонусы, CpS и номинал монеты, проводит покупки
 * (снаряжение, улучшения, гримуар, кот), начисляет пассивный и офлайн-доход, ведёт фазы звёзд,
 * Сновидения и Погружения и связывает всё это с забегом. Без Phaser/DOM.
 */
export class GameSession {
  readonly bus = new EventBus<SessionEvents>();
  readonly economy: Economy;
  readonly upgrades: Upgrades;
  readonly catUpgrades: Upgrades;
  readonly grimoire: Grimoire;
  readonly stars: Stars;
  readonly town: Town;
  readonly journal: Journal;
  readonly achievements: Achievements;
  readonly newspaper: Newspaper;
  readonly economyCfg: EconomyConfig;
  /** Выпуск газеты, ожидающий показа (SPEC §6). */
  pendingIssue: Issue | null = null;
  pendingOffline: OfflineReport | null = null;
  phase: PhaseInfo | null = null;
  /** Отладка: зафиксированная фаза звёзд (null — по времени). */
  forcedPhase: string | null = null;

  private cpsCache: Decimal = bn(0);
  private coinValueCache: Decimal = bn(1);
  private mods: RunModifiers = baseModifiers();
  private run: RunSim | null = null;
  private readonly unsubRun: (() => void)[] = [];
  private readonly sanityCfg: SanityConfig;
  private readonly dreamCfg: DreamConfig;
  private readonly hintWatcher: HintWatcher;
  private readonly hintQueue: HintId[] = [];
  private hintPollLeft = 0;
  private achievementLeft = 0;
  private lastMeters = 0;

  constructor(
    readonly state: GameState,
    cfg: SessionConfigs = {},
  ) {
    const upgrades = cfg.upgrades ?? upgradesConfig;
    this.economyCfg = cfg.economy ?? economyConfig;
    this.economy = new Economy(upgrades, this.economyCfg);
    this.upgrades = new Upgrades(upgrades);
    this.catUpgrades = new Upgrades({ ...upgrades, hero: (cfg.cat ?? catConfig).upgrades });
    this.grimoire = new Grimoire(cfg.grimoire ?? grimoireConfig);
    this.stars = new Stars(cfg.stars ?? starsConfig);
    this.sanityCfg = cfg.sanity ?? sanityConfig;
    this.dreamCfg = cfg.dream ?? dreamConfig;
    this.town = new Town(cfg.town ?? townConfig);
    this.journal = new Journal(cfg.journal ?? journalConfig);
    this.achievements = new Achievements(cfg.achievements ?? achievementsConfig);
    this.newspaper = new Newspaper(cfg.newspaper ?? newspaperConfig);
    this.hintWatcher = new HintWatcher(this, enemiesConfig, this.sanityCfg);
    this.recalc();
  }

  get cps(): Decimal {
    return this.cpsCache;
  }

  get coinValue(): Decimal {
    return this.coinValueCache;
  }

  get modifiers(): Readonly<RunModifiers> {
    return this.mods;
  }

  /** Множитель от тёмных звёзд (общий множитель дохода, SPEC §5.2). */
  get starMult(): number {
    return starMultiplier(this.state.darkStars, this.economyCfg.prestige);
  }

  earn(amount: Decimal): void {
    if (amount.lte(0)) return;
    const s = this.state;
    s.coins = s.coins.add(amount);
    s.coinsThisDive = s.coinsThisDive.add(amount);
    s.coinsLifetime = s.coinsLifetime.add(amount);
  }

  /** Пассивный доход и учёт времени игры; вызывать каждый кадр. */
  tick(dt: number): void {
    if (dt <= 0) return;
    const stats = this.state.stats;
    stats.playtimeSec += dt;
    if (this.cpsCache.gt(0)) this.earn(this.cpsCache.mul(dt));
    const run = this.run;
    if (run) {
      const m = run.meters;
      if (m > stats.bestDistanceM) stats.bestDistanceM = m;
      if (m > this.lastMeters) stats.distanceM += m - this.lastMeters;
      this.lastMeters = m;
      const w = this.state.world;
      w.biome = run.biomeId;
      w.progressM = run.biomeProgressM;
      w.lap = run.lap;
    }
    this.hintPollLeft -= dt;
    if (this.hintPollLeft <= 0) {
      this.hintPollLeft = HINT_POLL_SEC;
      this.pollHints();
    }
    this.achievementLeft -= dt;
    if (this.achievementLeft <= 0) {
      this.achievementLeft = ACHIEVEMENT_CHECK_SEC;
      this.checkAchievements();
    }
  }

  // --- Снаряжение ---

  itemLevel(id: string): number {
    return this.state.items[id] ?? 0;
  }

  quoteItem(id: string, amount: BuyAmount): ItemQuote {
    const owned = this.itemLevel(id);
    const count = this.economy.resolveAmount(id, owned, this.state.coins, amount);
    const cost = this.economy.itemCost(id, owned, count);
    return { count, cost, affordable: this.state.coins.gte(cost) };
  }

  buyItem(id: string, amount: BuyAmount): boolean {
    const q = this.quoteItem(id, amount);
    if (!q.affordable || q.count <= 0) return false;
    this.state.coins = this.state.coins.sub(q.cost);
    this.state.items[id] = this.itemLevel(id) + q.count;
    this.recalc();
    this.bus.emit('purchase', { kind: 'item', id });
    return true;
  }

  // --- Улучшения героя ---

  heroTier(id: string): number {
    return this.state.heroUpgrades[id] ?? 0;
  }

  heroNextCost(id: string): Decimal | null {
    const c = this.upgrades.nextCost(id, this.heroTier(id));
    return c === null ? null : bn(c);
  }

  buyHero(id: string): boolean {
    const cost = this.heroNextCost(id);
    if (!cost || this.state.coins.lt(cost)) return false;
    this.state.coins = this.state.coins.sub(cost);
    this.state.heroUpgrades[id] = this.heroTier(id) + 1;
    this.recalc();
    this.bus.emit('purchase', { kind: 'hero', id });
    return true;
  }

  // --- Гримуар ---

  ownedNodes(): ReadonlySet<string> {
    return new Set(this.state.grimoire);
  }

  buyNode(id: string): boolean {
    const s = this.state;
    if (!this.grimoire.canBuy(id, this.ownedNodes(), s.darkStars, s.essence)) return false;
    s.essence -= this.grimoire.node(id).cost;
    s.grimoire.push(id);
    this.recalc();
    this.bus.emit('purchase', { kind: 'grimoire', id });
    return true;
  }

  // --- Кот-фамильяр ---

  catTier(id: string): number {
    return this.state.cat.levels[id] ?? 0;
  }

  catNextCost(id: string): number | null {
    return this.catUpgrades.nextCost(id, this.catTier(id));
  }

  buyCat(id: string): boolean {
    const cost = this.catNextCost(id);
    if (cost === null || !this.state.cat.unlocked || this.state.sardines < cost) return false;
    this.state.sardines -= cost;
    this.state.cat.levels[id] = this.catTier(id) + 1;
    this.recalc();
    this.bus.emit('purchase', { kind: 'cat', id });
    return true;
  }

  // --- Небесные фазы ---

  /** Обновляет текущую фазу по времени; при смене слота рассылает событие. */
  updatePhase(nowMs: number): PhaseInfo {
    const info = this.forcedPhase
      ? this.forcedPhaseInfo(this.forcedPhase, nowMs)
      : this.stars.at(nowMs);
    const changed = !this.phase || this.phase.slot !== info.slot || this.phase.id !== info.id;
    this.phase = info;
    if (changed) {
      this.run?.setPhase(info.cfg);
      this.bus.emit('phase', info);
    }
    return info;
  }

  private forcedPhaseInfo(id: string, nowMs: number): PhaseInfo {
    const real = this.stars.at(nowMs);
    return { ...real, id, cfg: this.stars.cfg.phases[id] ?? real.cfg };
  }

  // --- Забег ---

  /** Подключает забег: номинал монеты, бонусы, фаза, зачисление наград в кошелёк. */
  attachRun(sim: RunSim): void {
    this.detachRun();
    this.run = sim;
    this.applyToRun();
    if (this.phase) sim.setPhase(this.phase.cfg);
    this.lastMeters = sim.meters;
    this.hintWatcher.attach(sim);
    const stats = this.state.stats;
    const world = this.state.world;
    this.unsubRun.push(
      sim.bus.on('coin', (e) => this.earn(e.reward)),
      sim.bus.on('catFetch', (e) => this.earn(e.reward)),
      sim.bus.on('kill', (e) => {
        this.earn(e.reward);
        this.state.essence += e.essence;
        stats.kills++;
        if (e.elite) stats.miniBossKills++;
        this.meet(e.type);
      }),
      sim.bus.on('chest', (c) => {
        this.earn(c.coins);
        this.state.sardines += c.sardines;
        stats.chests++;
      }),
      sim.bus.on('page', () => stats.pages++),
      sim.bus.on('vanish', () => stats.illusions++),
      sim.bus.on('bossDefeated', (b) => {
        this.earn(b.coins);
        this.state.essence += b.essence;
        this.state.sardines += b.sardines;
        stats.bossKills++;
        world.bosses[b.id] = (world.bosses[b.id] ?? 0) + 1;
        this.meet(b.id);
      }),
      sim.bus.on('biomeChange', (id) => {
        world.biome = id;
        world.progressM = 0;
        world.lap = sim.lap;
        if (!world.visited.includes(id)) world.visited.push(id);
        this.queueHint('biome');
      }),
      sim.bus.on('insight', (amount) => {
        this.earn(amount);
        stats.insights++;
      }),
      sim.bus.on('awakenStart', () => stats.awakenings++),
    );
  }

  detachRun(): void {
    for (const off of this.unsubRun) off();
    this.unsubRun.length = 0;
    this.hintWatcher.detach();
    this.run = null;
  }

  /** Встреча с тварью для дневника: первая — новая карточка, N-я — полная запись. */
  private meet(id: string): void {
    if (!this.journal.has(id)) return;
    const counts = this.state.journal;
    const before = this.journal.state(id, counts);
    counts[id] = (counts[id] ?? 0) + 1;
    const after = this.journal.state(id, counts);
    if (before === 'unknown') {
      this.bus.emit('journalNew', id);
      // Подсказка про дневник — со второй встреченной твари, когда есть что сравнить.
      if (this.journal.discovered(counts) >= 2) this.queueHint('journal');
    }
    if (after === 'full' && before !== 'full') {
      this.recalc();
      this.bus.emit('journalFull', id);
    }
  }

  // --- Городок ---

  buildingLevel(id: string): number {
    return this.state.town[id] ?? 0;
  }

  buildingCost(id: string): Decimal | null {
    return this.town.nextCost(id, this.buildingLevel(id));
  }

  buyBuilding(id: string): boolean {
    const cost = this.buildingCost(id);
    if (!cost || this.state.coins.lt(cost)) return false;
    this.state.coins = this.state.coins.sub(cost);
    this.state.town[id] = this.buildingLevel(id) + 1;
    this.recalc();
    this.bus.emit('purchase', { kind: 'town', id });
    return true;
  }

  // --- Подсказки ---

  /** Поставить подсказку в очередь (если её ещё не показывали). */
  queueHint(id: HintId): void {
    if (this.state.hints.includes(id) || this.hintQueue.includes(id)) return;
    this.hintQueue.push(id);
  }

  /** Следующая подсказка для показа; сразу считается показанной. */
  takeHint(): HintId | null {
    const id = this.hintQueue.shift() ?? null;
    if (id) this.state.hints.push(id);
    return id;
  }

  private pollHints(): void {
    const s = this.state;
    const owned = this.ownedNodes();
    const grimoireAffordable =
      s.grimoire.length === 0 &&
      this.grimoire.nodes.some((n) => this.grimoire.canBuy(n.id, owned, s.darkStars, s.essence));
    const cheapest = this.town.cheapest(s.town);
    this.hintWatcher.poll({
      grimoireAffordable,
      canDive: this.canDive,
      townAffordable:
        this.town.totalLevels(s.town) === 0 && cheapest !== null && s.coins.gte(cheapest),
    });
  }

  // --- Достижения ---

  checkAchievements(): void {
    const fresh = this.achievements.check(this.state, {
      journalFull: this.journal.fullCount(this.state.journal),
      townLevels: this.town.totalLevels(this.state.town),
    });
    if (fresh.length === 0) return;
    for (const a of fresh) this.state.achievements.push(a.id);
    this.recalc();
    for (const a of fresh) this.bus.emit('achievement', a);
    this.queueHint('achievement');
  }

  get achievementMult(): number {
    return this.achievements.multiplier(this.state.achievements.length);
  }

  // --- Утренняя газета ---

  /** Проверить, не вышла ли сегодня газета (время — от платформы). */
  checkNewspaper(timeMs: number): Issue | null {
    if (this.pendingIssue) return this.pendingIssue;
    this.pendingIssue = this.newspaper.issue(
      this.state.newspaper,
      timeMs,
      this.cpsCache,
      this.coinValueCache,
    );
    return this.pendingIssue;
  }

  claimNewspaper(): void {
    const issue = this.pendingIssue;
    if (!issue) return;
    this.pendingIssue = null;
    this.state.newspaper = { lastDay: issue.day, streak: issue.streak };
    this.earn(issue.coins);
    this.state.sardines += issue.sardines;
    this.state.essence += issue.essence;
  }

  // --- Сновидение ---

  /** Награда за сон (SPEC §4.6): f(монеты, кольца) × текущий доход в секунду, плюс сардинки. */
  dreamReward(points: number, rings: number): DreamReward {
    const r = this.dreamCfg.reward;
    // Если дохода ещё нет, опираемся на номинал монеты, чтобы первый сон не был пустым.
    const perPoint = this.cpsCache.mul(r.cpsSecPerPoint).add(this.coinValueCache);
    const coins = perPoint.mul(points * this.mods.dreamRewardMult);
    const sardines = Math.round(
      Math.max(r.minSardines, rings * r.sardinesPerRing) * this.mods.sardineMult,
    );
    return { coins, sardines };
  }

  claimDream(reward: DreamReward): void {
    this.earn(reward.coins);
    this.state.sardines += reward.sardines;
    this.state.stats.dreams++;
    if (!this.state.cat.unlocked) {
      this.state.cat.unlocked = true;
      if (this.run) this.run.catEnabled = true;
      this.bus.emit('catUnlocked', undefined);
    }
  }

  // --- Погружение ---

  get darkStarsAvailable(): number {
    return darkStarsFor(this.state.coinsThisDive, this.economyCfg.prestige);
  }

  get canDive(): boolean {
    return canDive(this.state.coinsThisDive, this.economyCfg.prestige);
  }

  omenChoices(): OmenConfig[] {
    return omenChoices(this.state.depth, this.economyCfg.prestige);
  }

  /**
   * Погружение (SPEC §6): сбрасывает дублоны, снаряжение, улучшения героя, Эссенцию и часть
   * гримуара; сохраняет тёмные звёзды, кота, сардинки, статистику. Новая глубина со знамением.
   */
  dive(omenId: string): boolean {
    if (!this.canDive) return false;
    const s = this.state;
    s.darkStars += this.darkStarsAvailable;
    s.coins = bn(this.economyCfg.startCoins);
    s.coinsThisDive = bn(0);
    s.items = {};
    s.heroUpgrades = {};
    s.essence = 0;
    s.grimoire = this.grimoire.keptAfterDive(s.grimoire);
    s.depth += 1;
    s.omen = this.economyCfg.prestige.omens.some((o) => o.id === omenId) ? omenId : null;
    // Путь по биомам начинается заново; побеждённые боссы и открытые биомы остаются в статистике.
    s.world = { ...createWorldState(), bosses: s.world.bosses, visited: s.world.visited };
    s.stats.dives++;
    this.recalc();
    this.bus.emit('dive', s.depth);
    return true;
  }

  // --- Офлайн ---

  /** Проверяет отсутствие с момента lastSeen; отчёт кладётся в pendingOffline и рассылается. */
  checkOffline(nowMs: number): OfflineReport | null {
    const cfg = this.economyCfg.offline;
    const from = this.state.lastSeen;
    // Фазы «тикают» и офлайн: берём средний множитель за время отсутствия.
    const phaseMult = this.stars.averageCoinMult(from, Math.max(from, nowMs));
    // Пассивный режим держит рассудок около idleSanity (SPEC §4.3).
    const sanityMult = cfg.useIdleSanity
      ? coinMultFor(this.sanityCfg.idleSanity, this.sanityCfg)
      : 1;
    const effectiveCps = this.cpsCache.mul(phaseMult * sanityMult * this.mods.offlineRateMult);
    const report = computeOffline(
      effectiveCps,
      from,
      nowMs,
      cfg,
      cfg.capSec + this.mods.offlineCapBonusSec,
    );
    this.state.lastSeen = Math.max(this.state.lastSeen, nowMs);
    if (!report) return null;
    if (this.pendingOffline) {
      // Не потерять предыдущий незабранный отчёт.
      report.amount = report.amount.add(this.pendingOffline.amount);
      report.awaySeconds += this.pendingOffline.awaySeconds;
      report.seconds += this.pendingOffline.seconds;
    }
    this.pendingOffline = report;
    this.bus.emit('offline', report);
    return report;
  }

  /** Забрать офлайн-доход; mult = 2 после просмотра rewarded-рекламы. */
  claimOffline(mult = 1): Decimal {
    const report = this.pendingOffline;
    if (!report) return bn(0);
    this.pendingOffline = null;
    const amount = report.amount.mul(mult);
    this.earn(amount);
    return amount;
  }

  // --- Онбординг ---

  completeTutorial(step: keyof TutorialState): void {
    if (this.state.tutorial[step]) return;
    this.state.tutorial[step] = true;
    this.bus.emit('tutorial', step);
  }

  /** Пересчитать бонусы после прямой правки состояния (админ-панель, миграции). */
  refreshBonuses(): void {
    this.recalc();
  }

  /** Сводит все источники бонусов: улучшения, гримуар, знамение, кот. */
  private recalc(): void {
    const s = this.state;
    const m = this.upgrades.modifiers(s.heroUpgrades);
    this.grimoire.modifiers(s.grimoire, m);
    const omen = this.economyCfg.prestige.omens.find((o) => o.id === s.omen);
    if (omen) applyEffect(m, omen);
    if (s.cat.unlocked) this.catUpgrades.modifiers(s.cat.levels, m);
    this.town.modifiers(s.town, m);
    this.journal.modifiers(s.journal, m);
    this.mods = m;
    const stars = this.starMult * this.achievementMult;
    this.cpsCache = this.economy.cps(s, m.cpsMult * stars);
    this.coinValueCache = this.economy.coinValue(this.cpsCache, m.coinValueMult * stars);
    this.applyToRun();
  }

  private applyToRun(): void {
    if (!this.run) return;
    this.run.applyModifiers(this.mods);
    this.run.coinValue = this.coinValueCache;
    this.run.catEnabled = this.state.cat.unlocked;
  }
}
