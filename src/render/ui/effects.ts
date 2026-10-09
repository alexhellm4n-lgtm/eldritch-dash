import type { ModifierKey, RunModifiers } from '../../config/types';
import { hasKey, tId } from '../../i18n';

/** Значения, которые показываем в процентах или часах, а не «как есть». */
const PERCENT_ADD: ReadonlySet<ModifierKey> = new Set(['attackRangeMult', 'chestChanceBonus']);
const HOURS_ADD: ReadonlySet<ModifierKey> = new Set(['offlineCapBonusSec']);

function formatAdd(key: ModifierKey, v: number): string {
  if (PERCENT_ADD.has(key)) return String(Math.round(v * 100));
  if (HOURS_ADD.has(key)) return String(Math.round(v / 360) / 10);
  return String(Math.round(v * 100) / 100);
}

/** Описание эффекта узла/знамения для игрока: «радиус вспышки +10 %, Эссенция ×1.15». */
export function describeEffect(effect: {
  add?: Partial<RunModifiers>;
  mul?: Partial<RunModifiers>;
}): string {
  const parts: string[] = [];
  for (const [key, v] of Object.entries(effect.add ?? {}) as [ModifierKey, number][]) {
    const k = `effect.add.${key}`;
    if (hasKey(k)) parts.push(tId(k, { v: formatAdd(key, v) }));
  }
  for (const [key, v] of Object.entries(effect.mul ?? {}) as [ModifierKey, number][]) {
    const k = `effect.mul.${key}`;
    if (hasKey(k)) parts.push(tId(k, { v: String(Math.round(v * 100) / 100) }));
  }
  return parts.join(', ');
}

/** Эффект, применённый `times` раз (уровни постройки): прибавки × times, множители ^ times. */
export function scaleEffect(
  effect: { add?: Partial<RunModifiers>; mul?: Partial<RunModifiers> },
  times: number,
): { add: Partial<RunModifiers>; mul: Partial<RunModifiers> } {
  const add: Partial<RunModifiers> = {};
  const mul: Partial<RunModifiers> = {};
  for (const [key, v] of Object.entries(effect.add ?? {}) as [ModifierKey, number][])
    add[key] = v * times;
  for (const [key, v] of Object.entries(effect.mul ?? {}) as [ModifierKey, number][])
    mul[key] = v ** times;
  return { add, mul };
}
