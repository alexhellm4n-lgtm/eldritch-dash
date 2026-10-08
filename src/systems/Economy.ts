import type { EconomyConfig, ItemConfig, UpgradesConfig } from '../config/types';
import { bn, Decimal, ZERO } from '../core/BigNum';
import type { GameState } from '../core/GameState';

export type BuyAmount = 1 | 10 | 100 | 'max';

/** Формулы экономики (SPEC §5.2): цены, пассивный доход, номинал монеты. Без состояния. */
export class Economy {
  private readonly itemById = new Map<string, ItemConfig>();

  constructor(
    readonly upgrades: UpgradesConfig,
    readonly economy: EconomyConfig,
  ) {
    for (const item of upgrades.items) this.itemById.set(item.id, item);
  }

  item(id: string): ItemConfig {
    const item = this.itemById.get(id);
    if (!item) throw new Error(`Неизвестное снаряжение: ${id}`);
    return item;
  }

  /** Цена `count` уровней, начиная с текущего `owned`: Σ base × growth^n. */
  itemCost(id: string, owned: number, count: number): Decimal {
    if (count <= 0) return ZERO;
    const item = this.item(id);
    return Decimal.sumGeometricSeries(count, item.base, this.upgrades.growth, owned);
  }

  /** Сколько уровней можно купить на `coins`. */
  maxAffordable(id: string, owned: number, coins: Decimal): number {
    const item = this.item(id);
    const n = Decimal.affordGeometricSeries(coins, item.base, this.upgrades.growth, owned);
    return Math.max(0, Math.floor(n.toNumber()));
  }

  /** Количество к покупке для режима ×1/×10/×100/MAX (MAX — минимум 1, чтобы показать цену). */
  resolveAmount(id: string, owned: number, coins: Decimal, amount: BuyAmount): number {
    if (amount !== 'max') return amount;
    return Math.max(1, this.maxAffordable(id, owned, coins));
  }

  /** Множитель вех 25/50/100/200: ×2 за каждую достигнутую. */
  milestoneMultiplier(level: number): number {
    const m = this.upgrades.milestones;
    let mult = 1;
    for (const l of m.levels) if (level >= l) mult *= m.multiplier;
    return mult;
  }

  /** Следующая веха для уровня (или null, если все пройдены). */
  nextMilestone(level: number): number | null {
    for (const l of this.upgrades.milestones.levels) if (level < l) return l;
    return null;
  }

  itemCps(id: string, level: number): Decimal {
    if (level <= 0) return ZERO;
    return bn(this.item(id).cps).mul(level * this.milestoneMultiplier(level));
  }

  /** CpS = Σ(уровень × cps × вехи) × глобальные множители. */
  cps(state: GameState, globalMult = 1): Decimal {
    let total = ZERO;
    for (const item of this.upgrades.items) {
      total = total.add(this.itemCps(item.id, state.items[item.id] ?? 0));
    }
    return total.mul(globalMult);
  }

  /** Номинал монеты в забеге: (1 + CpS × 0.15) × множители — активная игра выгоднее простоя. */
  coinValue(cps: Decimal, mult: number): Decimal {
    const c = this.economy.coin;
    return cps
      .mul(c.cpsFactor)
      .add(1)
      .mul(c.baseValue * mult);
  }
}
