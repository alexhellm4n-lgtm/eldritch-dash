import { bn } from '../core/BigNum';
import {
  createGameState,
  createWorldState,
  type GameState,
  type WorldState,
} from '../core/GameState';

export const SAVE_VERSION = 3;

/**
 * Сохранение на диске: Decimal — строками, остальное как есть.
 * v2 добавила мета-системы M3, v3 — контент M4 (биомы, городок, дневник, достижения, газета, подсказки).
 */
export interface SaveData {
  v: typeof SAVE_VERSION;
  coins: string;
  coinsThisDive: string;
  coinsLifetime: string;
  essence: number;
  sardines: number;
  darkStars: number;
  depth: number;
  omen: string | null;
  items: Record<string, number>;
  heroUpgrades: Record<string, number>;
  grimoire: string[];
  cat: GameState['cat'];
  tutorial: GameState['tutorial'];
  hints: string[];
  world: WorldState;
  town: Record<string, number>;
  journal: Record<string, number>;
  achievements: string[];
  newspaper: GameState['newspaper'];
  settings: GameState['settings'];
  stats: GameState['stats'];
  lastSeen: number;
  createdAt: number;
}

export function toSaveData(s: GameState): SaveData {
  return {
    v: SAVE_VERSION,
    coins: s.coins.toString(),
    coinsThisDive: s.coinsThisDive.toString(),
    coinsLifetime: s.coinsLifetime.toString(),
    essence: s.essence,
    sardines: s.sardines,
    darkStars: s.darkStars,
    depth: s.depth,
    omen: s.omen,
    items: { ...s.items },
    heroUpgrades: { ...s.heroUpgrades },
    grimoire: [...s.grimoire],
    cat: { unlocked: s.cat.unlocked, levels: { ...s.cat.levels } },
    tutorial: { ...s.tutorial },
    hints: [...s.hints],
    world: {
      ...s.world,
      bosses: { ...s.world.bosses },
      visited: [...s.world.visited],
    },
    town: { ...s.town },
    journal: { ...s.journal },
    achievements: [...s.achievements],
    newspaper: { ...s.newspaper },
    settings: { ...s.settings },
    stats: { ...s.stats },
    lastSeen: s.lastSeen,
    createdAt: s.createdAt,
  };
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/** Неотрицательное число (валюты, счётчики). */
function amount(v: unknown): number {
  return Math.max(0, num(v, 0));
}

function count(v: unknown): number {
  return Math.floor(amount(v));
}

function decimal(v: unknown, fallback: string): ReturnType<typeof bn> {
  if (typeof v !== 'string' && typeof v !== 'number') return bn(fallback);
  try {
    const d = bn(v);
    return Number.isFinite(d.mantissa) && d.gte(0) ? d : bn(fallback);
  } catch {
    // break_infinity бросает DecimalError на нечисловой строке.
    return bn(fallback);
  }
}

/** Только целые неотрицательные уровни; мусор отбрасывается. */
function levels(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(v)) return out;
  for (const [k, lvl] of Object.entries(v)) {
    if (typeof lvl === 'number' && Number.isInteger(lvl) && lvl > 0) out[k] = lvl;
  }
  return out;
}

function ids(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x): x is string => typeof x === 'string'))];
}

/**
 * Восстанавливает GameState из сохранения последней версии. Отсутствующие или битые поля
 * заменяются значениями по умолчанию — повреждённое поле не должно стоить игроку всего прогресса.
 */
export function fromSaveData(raw: unknown, now: number): GameState {
  const d = isObj(raw) ? raw : {};
  const base = createGameState(now);
  const tutorial = isObj(d.tutorial) ? d.tutorial : {};
  const settings = isObj(d.settings) ? d.settings : {};
  const stats = isObj(d.stats) ? d.stats : {};
  const cat = isObj(d.cat) ? d.cat : {};
  const world = isObj(d.world) ? d.world : {};
  const paper = isObj(d.newspaper) ? d.newspaper : {};
  const startWorld = createWorldState();
  return {
    coins: decimal(d.coins, '0'),
    coinsThisDive: decimal(d.coinsThisDive, '0'),
    coinsLifetime: decimal(d.coinsLifetime, '0'),
    essence: amount(d.essence),
    sardines: count(d.sardines),
    darkStars: count(d.darkStars),
    depth: Math.max(1, count(d.depth)),
    omen: typeof d.omen === 'string' ? d.omen : null,
    items: levels(d.items),
    heroUpgrades: levels(d.heroUpgrades),
    grimoire: ids(d.grimoire),
    cat: { unlocked: cat.unlocked === true, levels: levels(cat.levels) },
    tutorial: {
      jump: tutorial.jump === true,
      glide: tutorial.glide === true,
      purchase: tutorial.purchase === true,
    },
    hints: ids(d.hints),
    world: {
      biome: typeof world.biome === 'string' ? world.biome : startWorld.biome,
      progressM: amount(world.progressM),
      lap: count(world.lap),
      bosses: levels(world.bosses),
      visited: ids(world.visited).length > 0 ? ids(world.visited) : startWorld.visited,
    },
    town: levels(d.town),
    journal: levels(d.journal),
    achievements: ids(d.achievements),
    newspaper: { lastDay: count(paper.lastDay), streak: count(paper.streak) },
    settings: {
      notation: settings.notation === 'scientific' ? 'scientific' : base.settings.notation,
      reduceDistortion: settings.reduceDistortion === true,
    },
    stats: {
      playtimeSec: amount(stats.playtimeSec),
      bestDistanceM: amount(stats.bestDistanceM),
      kills: count(stats.kills),
      dreams: count(stats.dreams),
      awakenings: count(stats.awakenings),
      insights: count(stats.insights),
      dives: count(stats.dives),
      distanceM: amount(stats.distanceM),
      bossKills: count(stats.bossKills),
      miniBossKills: count(stats.miniBossKills),
      chests: count(stats.chests),
      pages: count(stats.pages),
      illusions: count(stats.illusions),
    },
    lastSeen: num(d.lastSeen, now),
    createdAt: num(d.createdAt, now),
  };
}
