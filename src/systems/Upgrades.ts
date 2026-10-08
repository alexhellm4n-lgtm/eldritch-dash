import type { HeroUpgradeConfig, ModifierKey, RunModifiers, UpgradesConfig } from '../config/types';

export function baseModifiers(): RunModifiers {
  return {
    attackRangeMult: 1,
    staminaBonusSec: 0,
    speedBonus: 0,
    magnetRadius: 0,
    extraJumps: 0,
    coinValueMult: 1,
    autoJump: 0,
  };
}

/** Улучшения героя (SPEC §5.4): тиры по порядку, эффекты складываются/перемножаются. */
export class Upgrades {
  private readonly byId = new Map<string, HeroUpgradeConfig>();

  constructor(readonly cfg: UpgradesConfig) {
    for (const u of cfg.hero) this.byId.set(u.id, u);
  }

  get list(): readonly HeroUpgradeConfig[] {
    return this.cfg.hero;
  }

  get(id: string): HeroUpgradeConfig {
    const u = this.byId.get(id);
    if (!u) throw new Error(`Неизвестное улучшение: ${id}`);
    return u;
  }

  maxTier(id: string): number {
    return this.get(id).costs.length;
  }

  /** Цена следующего тира или null, если куплены все. */
  nextCost(id: string, tier: number): number | null {
    return this.get(id).costs[tier] ?? null;
  }

  modifiers(tiers: Readonly<Record<string, number>>): RunModifiers {
    const m = baseModifiers();
    for (const u of this.cfg.hero) {
      const tier = Math.min(tiers[u.id] ?? 0, u.costs.length);
      if (tier <= 0) continue;
      if (u.add) {
        for (const key of Object.keys(u.add) as ModifierKey[]) m[key] += (u.add[key] ?? 0) * tier;
      }
      if (u.mul) {
        for (const key of Object.keys(u.mul) as ModifierKey[]) m[key] *= (u.mul[key] ?? 1) ** tier;
      }
    }
    return m;
  }
}
