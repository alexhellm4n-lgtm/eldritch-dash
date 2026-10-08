import type { HeroUpgradeConfig, ModifierKey, RunModifiers, UpgradesConfig } from '../config/types';

export function baseModifiers(): RunModifiers {
  return {
    attackRangeMult: 1,
    staminaBonusSec: 0,
    speedBonus: 0,
    speedMult: 1,
    magnetRadius: 0,
    extraJumps: 0,
    coinValueMult: 1,
    autoJump: 0,
    cpsMult: 1,
    essenceMult: 1,
    offlineCapBonusSec: 0,
    offlineRateMult: 1,
    sanityDrainMult: 1,
    sanityPickupMult: 1,
    contactLossMult: 1,
    insightRewardMult: 1,
    awakeningKillsMult: 1,
    awakeningDurationMult: 1,
    awakeningCoinMult: 0,
    dreamRewardMult: 1,
    pageChanceMult: 1,
    sardineMult: 1,
    chestChanceBonus: 0,
    catIntervalMult: 1,
    catRangeBonus: 0,
  };
}

/** Применяет эффект `times` раз: прибавки складываются, множители возводятся в степень. */
export function applyEffect(
  m: RunModifiers,
  effect: { add?: Partial<RunModifiers>; mul?: Partial<RunModifiers> },
  times = 1,
): void {
  if (times <= 0) return;
  if (effect.add) {
    for (const key of Object.keys(effect.add) as ModifierKey[])
      m[key] += (effect.add[key] ?? 0) * times;
  }
  if (effect.mul) {
    for (const key of Object.keys(effect.mul) as ModifierKey[])
      m[key] *= (effect.mul[key] ?? 1) ** times;
  }
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

  modifiers(
    tiers: Readonly<Record<string, number>>,
    into: RunModifiers = baseModifiers(),
  ): RunModifiers {
    for (const u of this.cfg.hero) applyEffect(into, u, Math.min(tiers[u.id] ?? 0, u.costs.length));
    return into;
  }
}
