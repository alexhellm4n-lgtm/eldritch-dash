import { SAVE_VERSION } from './schema';

/** Миграция сохранения с версии N на N+1 (ключ — исходная версия). */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Цепочка миграций. При изменении формата: поднять SAVE_VERSION в schema.ts,
 * добавить сюда функцию `[старая версия]: (d) => ({ ...d, v: старая + 1, ... })` и тест.
 */
export const migrations: Readonly<Record<number, Migration>> = {
  // 0 — сохранения без поля v (не выпускались, но формат допускаем).
  0: (d) => ({ ...d, v: 1 }),
  // 1 → 2: мета-системы M3. Новые поля получают нейтральные значения; глубина — первая.
  1: (d) => ({
    ...d,
    v: 2,
    essence: 0,
    sardines: 0,
    darkStars: 0,
    depth: 1,
    omen: null,
    grimoire: [],
    cat: { unlocked: false, levels: {} },
  }),
  // 2 → 3: контент M4. Путь начинается с побережья; лучшая дистанция идёт в общий пробег.
  2: (d) => {
    const stats = typeof d.stats === 'object' && d.stats !== null ? d.stats : {};
    const best = (stats as Record<string, unknown>).bestDistanceM;
    return {
      ...d,
      v: 3,
      hints: [],
      world: { biome: 'coast', progressM: 0, lap: 0, bosses: {}, visited: ['coast'] },
      town: {},
      journal: {},
      achievements: [],
      newspaper: { lastDay: 0, streak: 0 },
      stats: { ...stats, distanceM: typeof best === 'number' ? best : 0 },
    };
  },
  // 3 → 4: скины кота. Кот остаётся в привычной чёрной шкурке.
  3: (d) => {
    const cat = typeof d.cat === 'object' && d.cat !== null ? d.cat : {};
    return { ...d, v: 4, cat: { ...cat, skin: 'midnight', skins: [] } };
  },
};

export class SaveVersionError extends Error {}

/** Прогоняет данные через цепочку до `target`. Сохранение из будущей версии не трогаем. */
export function migrate(
  data: Record<string, unknown>,
  chain: Readonly<Record<number, Migration>> = migrations,
  target = SAVE_VERSION,
): Record<string, unknown> {
  let current = data;
  let v = typeof current.v === 'number' ? current.v : 0;
  if (v > target) throw new SaveVersionError(`Сохранение версии ${v} новее игры (${target})`);
  while (v < target) {
    const step = chain[v];
    if (!step) throw new SaveVersionError(`Нет миграции с версии ${v}`);
    current = step(current);
    const next = typeof current.v === 'number' ? current.v : NaN;
    if (next !== v + 1) throw new SaveVersionError(`Миграция ${v} вернула версию ${next}`);
    v = next;
  }
  return current;
}
