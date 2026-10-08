import {
  economyConfig,
  upgradesConfig,
  type EconomyConfig,
  type RunModifiers,
  type UpgradesConfig,
} from '../config';
import { bn, type Decimal } from '../core/BigNum';
import { EventBus } from '../core/EventBus';
import type { GameState, TutorialState } from '../core/GameState';
import { Economy, type BuyAmount } from './Economy';
import { computeOffline, type OfflineReport } from './Offline';
import type { RunSim } from './RunSim';
import { Upgrades } from './Upgrades';

export interface SessionEvents {
  purchase: { kind: 'item' | 'hero'; id: string };
  offline: OfflineReport;
  tutorial: keyof TutorialState;
}

export interface ItemQuote {
  count: number;
  cost: Decimal;
  affordable: boolean;
}

/**
 * Игровая сессия: владеет GameState, считает CpS/номинал монеты, проводит покупки,
 * начисляет пассивный и офлайн-доход и связывает экономику с забегом. Без Phaser/DOM.
 */
export class GameSession {
  readonly bus = new EventBus<SessionEvents>();
  readonly economy: Economy;
  readonly upgrades: Upgrades;
  pendingOffline: OfflineReport | null = null;

  private cpsCache: Decimal = bn(0);
  private coinValueCache: Decimal = bn(1);
  private mods: RunModifiers;
  private run: RunSim | null = null;
  private readonly unsubRun: (() => void)[] = [];

  constructor(
    readonly state: GameState,
    upgrades: UpgradesConfig = upgradesConfig,
    readonly economyCfg: EconomyConfig = economyConfig,
  ) {
    this.economy = new Economy(upgrades, economyCfg);
    this.upgrades = new Upgrades(upgrades);
    this.mods = this.upgrades.modifiers(state.heroUpgrades);
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
    this.state.stats.playtimeSec += dt;
    if (this.cpsCache.gt(0)) this.earn(this.cpsCache.mul(dt));
    if (this.run) {
      const m = this.run.meters;
      if (m > this.state.stats.bestDistanceM) this.state.stats.bestDistanceM = m;
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

  // --- Забег ---

  /** Подключает забег: номинал монеты, модификаторы, зачисление наград в кошелёк. */
  attachRun(sim: RunSim): void {
    this.detachRun();
    this.run = sim;
    this.applyToRun();
    this.unsubRun.push(
      sim.bus.on('coin', (e) => this.earn(e.reward)),
      sim.bus.on('kill', (e) => {
        this.earn(e.reward);
        this.state.stats.kills++;
      }),
    );
  }

  detachRun(): void {
    for (const off of this.unsubRun) off();
    this.unsubRun.length = 0;
    this.run = null;
  }

  // --- Офлайн ---

  /** Проверяет отсутствие с момента lastSeen; отчёт кладётся в pendingOffline и рассылается. */
  checkOffline(nowMs: number): OfflineReport | null {
    const report = computeOffline(
      this.cpsCache,
      this.state.lastSeen,
      nowMs,
      this.economyCfg.offline,
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

  private recalc(): void {
    this.mods = this.upgrades.modifiers(this.state.heroUpgrades);
    this.cpsCache = this.economy.cps(this.state);
    this.coinValueCache = this.economy.coinValue(this.cpsCache, this.mods.coinValueMult);
    this.applyToRun();
  }

  private applyToRun(): void {
    if (!this.run) return;
    this.run.applyModifiers(this.mods);
    this.run.coinValue = this.coinValueCache;
  }
}
