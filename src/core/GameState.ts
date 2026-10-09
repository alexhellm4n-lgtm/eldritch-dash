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
  /** Пройдено всего, м (за все забеги). */
  distanceM: number;
  bossKills: number;
  miniBossKills: number;
  chests: number;
  pages: number;
  illusions: number;
}

export interface CatState {
  /** Кот-фамильяр открывается после первого Сновидения. */
  unlocked: boolean;
  /** Уровни прокачки за сардинки. */
  levels: Record<string, number>;
}

/** Продвижение по биомам (SPEC §7): текущий биом, путь до босса, круг. */
export interface WorldState {
  biome: string;
  /** Пройдено в текущем биоме, м (босс — при достижении длины биома). */
  progressM: number;
  /** Круг: после финального босса биомы идут заново — твари крепче, награды щедрее. */
  lap: number;
  /** Сколько раз побеждён каждый босс. */
  bosses: Record<string, number>;
  /** Биомы, в которых уже доводилось бывать. */
  visited: string[];
}

/** Утренняя газета (ежедневная награда): последний день выпуска и серия дней подряд. */
export interface NewspaperState {
  /** Номер дня (сутки от эпохи по времени платформы); 0 — газет ещё не было. */
  lastDay: number;
  streak: number;
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
  /** Показанные подсказки по механикам (больше не повторяются). */
  hints: string[];
  world: WorldState;
  /** Уровни построек городка (переживают Погружение). */
  town: Record<string, number>;
  /** Дневник исследователя: сколько раз побеждена каждая тварь. */
  journal: Record<string, number>;
  /** Полученные достижения. */
  achievements: string[];
  newspaper: NewspaperState;
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
    hints: [],
    world: createWorldState(),
    town: {},
    journal: {},
    achievements: [],
    newspaper: { lastDay: 0, streak: 0 },
    settings: { notation: 'suffix', reduceDistortion: false },
    stats: {
      playtimeSec: 0,
      bestDistanceM: 0,
      kills: 0,
      dreams: 0,
      awakenings: 0,
      insights: 0,
      dives: 0,
      distanceM: 0,
      bossKills: 0,
      miniBossKills: 0,
      chests: 0,
      pages: 0,
      illusions: 0,
    },
    lastSeen: now,
    createdAt: now,
  };
}

/** Начало пути: побережье, первый круг. */
export function createWorldState(): WorldState {
  return { biome: 'coast', progressM: 0, lap: 0, bosses: {}, visited: ['coast'] };
}
