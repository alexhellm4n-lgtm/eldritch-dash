import type { BuildingConfig, RunModifiers, TownConfig } from '../config/types';
import { bn, type Decimal } from '../core/BigNum';
import { applyEffect } from './Upgrades';

/** Городок на утёсе (SPEC §6): постройки за дублоны, бонусы за уровни переживают Погружение. */
export class Town {
  private readonly byId = new Map<string, BuildingConfig>();

  constructor(readonly cfg: TownConfig) {
    for (const b of cfg.buildings) this.byId.set(b.id, b);
  }

  get list(): readonly BuildingConfig[] {
    return this.cfg.buildings;
  }

  get(id: string): BuildingConfig {
    const b = this.byId.get(id);
    if (!b) throw new Error(`Неизвестная постройка: ${id}`);
    return b;
  }

  /** Цена следующего уровня или null на максимуме. */
  nextCost(id: string, level: number): Decimal | null {
    const b = this.get(id);
    if (level >= b.maxLevel) return null;
    return bn(b.base).mul(bn(b.growth).pow(level));
  }

  /** Самая дешёвая доступная постройка (для подсказки). */
  cheapest(levels: Readonly<Record<string, number>>): Decimal | null {
    let best: Decimal | null = null;
    for (const b of this.cfg.buildings) {
      const c = this.nextCost(b.id, levels[b.id] ?? 0);
      if (c && (!best || c.lt(best))) best = c;
    }
    return best;
  }

  totalLevels(levels: Readonly<Record<string, number>>): number {
    let n = 0;
    for (const b of this.cfg.buildings) n += Math.min(levels[b.id] ?? 0, b.maxLevel);
    return n;
  }

  modifiers(levels: Readonly<Record<string, number>>, into: RunModifiers): RunModifiers {
    for (const b of this.cfg.buildings)
      applyEffect(into, b, Math.min(levels[b.id] ?? 0, b.maxLevel));
    return into;
  }

  /** Насколько рассеян туман над городком: 0 — густой, 1 — ясно (по уровню маяка). */
  fogCleared(levels: Readonly<Record<string, number>>): number {
    return Math.min(1, (levels.lighthouse ?? 0) / this.cfg.fogClearLevel);
  }
}
