import { bn, type Decimal, type Notation } from './BigNum';

export interface TutorialState {
  jump: boolean;
  glide: boolean;
  purchase: boolean;
}

export interface Settings {
  notation: Notation;
  /** «Уменьшить искажения» для чувствительных игроков (SPEC §8.3). */
  reduceDistortion: boolean;
}

export interface GameStats {
  /** Суммарное время в игре, с (для разрешения конфликтов облачных сохранений). */
  playtimeSec: number;
  bestDistanceM: number;
  kills: number;
  dreams: number;
  awakenings: number;
  insights: number;
  dives: number;
}

export interface CatState {
  /** Кот-фамильяр открывается после первого Сновидения. */
  unlocked: boolean;
  /** Уровни прокачки за сардинки. */
  levels: Record<string, number>;
}

/** Единое сериализуемое состояние игры. Деньги — Decimal (break_infinity). */
export interface GameState {
  coins: Decimal;
  /** Заработано за текущее погружение (основа престижа, SPEC §5.2). */
  coinsThisDive: Decimal;
  coinsLifetime: Decimal;
  /** Эссенция — валюта гримуара. */
  essence: number;
  /** Сардинки — валюта кота. */
  sardines: number;
  /** Тёмные звёзды — постоянная валюта престижа. */
  darkStars: number;
  /** Номер текущей глубины (1 — до первого Погружения). */
  depth: number;
  /** Знамение текущего погружения. */
  omen: string | null;
  /** Уровни снаряжения (пассивный доход). */
  items: Record<string, number>;
  /** Купленные тиры улучшений героя. */
  heroUpgrades: Record<string, number>;
  /** Купленные узлы гримуара. */
  grimoire: string[];
  cat: CatState;
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
    essence: 0,
    sardines: 0,
    darkStars: 0,
    depth: 1,
    omen: null,
    items: {},
    heroUpgrades: {},
    grimoire: [],
    cat: { unlocked: false, levels: {} },
    tutorial: { jump: false, glide: false, purchase: false },
    settings: { notation: 'suffix', reduceDistortion: false },
    stats: {
      playtimeSec: 0,
      bestDistanceM: 0,
      kills: 0,
      dreams: 0,
      awakenings: 0,
      insights: 0,
      dives: 0,
    },
    lastSeen: now,
    createdAt: now,
  };
}
