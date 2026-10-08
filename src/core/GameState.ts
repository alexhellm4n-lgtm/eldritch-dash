import { bn, type Decimal, type Notation } from './BigNum';

export interface TutorialState {
  jump: boolean;
  glide: boolean;
  purchase: boolean;
}

export interface Settings {
  notation: Notation;
}

export interface GameStats {
  /** Суммарное время в игре, с (для разрешения конфликтов облачных сохранений). */
  playtimeSec: number;
  bestDistanceM: number;
  kills: number;
}

/** Единое сериализуемое состояние игры. Деньги — Decimal (break_infinity). */
export interface GameState {
  coins: Decimal;
  /** Заработано за текущее погружение (основа престижа, SPEC §5.2). */
  coinsThisDive: Decimal;
  coinsLifetime: Decimal;
  /** Уровни снаряжения (пассивный доход). */
  items: Record<string, number>;
  /** Купленные тиры улучшений героя. */
  heroUpgrades: Record<string, number>;
  tutorial: TutorialState;
  settings: Settings;
  stats: GameStats;
  /** Время последнего сохранения/активности, мс (для офлайн-дохода). */
  lastSeen: number;
  createdAt: number;
}

export function createGameState(now: number, startCoins = 0): GameState {
  return {
    coins: bn(startCoins),
    coinsThisDive: bn(0),
    coinsLifetime: bn(0),
    items: {},
    heroUpgrades: {},
    tutorial: { jump: false, glide: false, purchase: false },
    settings: { notation: 'suffix' },
    stats: { playtimeSec: 0, bestDistanceM: 0, kills: 0 },
    lastSeen: now,
    createdAt: now,
  };
}
