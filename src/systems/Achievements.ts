import type { AchievementsConfig } from '../config/types';
import type { GameState } from '../core/GameState';

export interface AchievementDef {
  /** `${stat}_${номер тира}`. */
  id: string;
  stat: string;
  /** Номер тира с 1 (для римской цифры в названии). */
  tier: number;
  target: number;
}

/** Показатели, которые нельзя прочитать из stats напрямую (считаются по состоянию). */
export interface DerivedStats {
  journalFull: number;
  townLevels: number;
}

/** Достижения (SPEC §6): каждое даёт +bonus к доходу. Тиры по показателям из конфига. */
export class Achievements {
  readonly list: readonly AchievementDef[];

  constructor(readonly cfg: AchievementsConfig) {
    const list: AchievementDef[] = [];
    for (const g of cfg.groups) {
      g.tiers.forEach((target, i) =>
        list.push({ id: `${g.stat}_${i + 1}`, stat: g.stat, tier: i + 1, target }),
      );
    }
    this.list = list;
  }

  /** Множитель дохода от полученных достижений. */
  multiplier(owned: number): number {
    return 1 + this.cfg.bonusPerAchievement * owned;
  }

  /** Новые достижения, которые выполнены, но ещё не получены. */
  check(state: GameState, derived: DerivedStats): AchievementDef[] {
    const have = new Set(state.achievements);
    const out: AchievementDef[] = [];
    for (const a of this.list) {
      if (!have.has(a.id) && statValue(state, a.stat, derived) >= a.target) out.push(a);
    }
    return out;
  }
}

/** Значение показателя достижений. Неизвестный показатель — 0 (ловит tests/config.test.ts). */
export function statValue(s: GameState, stat: string, d: DerivedStats): number {
  const st = s.stats;
  switch (stat) {
    case 'kills':
      return st.kills;
    case 'distanceM':
      return st.distanceM;
    case 'coinsLifetime':
      return s.coinsLifetime.toNumber();
    case 'dreams':
      return st.dreams;
    case 'awakenings':
      return st.awakenings;
    case 'insights':
      return st.insights;
    case 'dives':
      return st.dives;
    case 'bossKills':
      return st.bossKills;
    case 'miniBossKills':
      return st.miniBossKills;
    case 'chests':
      return st.chests;
    case 'pages':
      return st.pages;
    case 'illusions':
      return st.illusions;
    case 'journalFull':
      return d.journalFull;
    case 'townLevels':
      return d.townLevels;
    case 'grimoireNodes':
      return s.grimoire.length;
    case 'itemLevels':
      return sum(s.items);
    case 'catLevels':
      return sum(s.cat.levels);
    case 'newsStreak':
      return s.newspaper.streak;
    case 'biomes':
      return s.world.visited.length;
    case 'laps':
      return s.world.lap;
    default:
      return 0;
  }
}

export const ACHIEVEMENT_STATS = [
  'kills',
  'distanceM',
  'coinsLifetime',
  'dreams',
  'awakenings',
  'insights',
  'dives',
  'bossKills',
  'miniBossKills',
  'chests',
  'pages',
  'illusions',
  'journalFull',
  'townLevels',
  'grimoireNodes',
  'itemLevels',
  'catLevels',
  'newsStreak',
  'biomes',
  'laps',
] as const;

function sum(levels: Readonly<Record<string, number>>): number {
  let n = 0;
  for (const v of Object.values(levels)) n += v;
  return n;
}
