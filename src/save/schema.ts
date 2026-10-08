import { bn } from '../core/BigNum';
import { createGameState, type GameState } from '../core/GameState';

export const SAVE_VERSION = 1;

/** Сохранение v1 на диске: Decimal — строками, остальное как есть. */
export interface SaveDataV1 {
  v: 1;
  coins: string;
  coinsThisDive: string;
  coinsLifetime: string;
  items: Record<string, number>;
  heroUpgrades: Record<string, number>;
  tutorial: GameState['tutorial'];
  settings: GameState['settings'];
  stats: GameState['stats'];
  lastSeen: number;
  createdAt: number;
}

export function toSaveData(s: GameState): SaveDataV1 {
  return {
    v: SAVE_VERSION,
    coins: s.coins.toString(),
    coinsThisDive: s.coinsThisDive.toString(),
    coinsLifetime: s.coinsLifetime.toString(),
    items: { ...s.items },
    heroUpgrades: { ...s.heroUpgrades },
    tutorial: { ...s.tutorial },
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
  return {
    coins: decimal(d.coins, '0'),
    coinsThisDive: decimal(d.coinsThisDive, '0'),
    coinsLifetime: decimal(d.coinsLifetime, '0'),
    items: levels(d.items),
    heroUpgrades: levels(d.heroUpgrades),
    tutorial: {
      jump: tutorial.jump === true,
      glide: tutorial.glide === true,
      purchase: tutorial.purchase === true,
    },
    settings: {
      notation: settings.notation === 'scientific' ? 'scientific' : base.settings.notation,
    },
    stats: {
      playtimeSec: Math.max(0, num(stats.playtimeSec, 0)),
      bestDistanceM: Math.max(0, num(stats.bestDistanceM, 0)),
      kills: Math.max(0, Math.floor(num(stats.kills, 0))),
    },
    lastSeen: num(d.lastSeen, now),
    createdAt: num(d.createdAt, now),
  };
}
