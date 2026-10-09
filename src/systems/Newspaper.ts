import type { NewspaperConfig } from '../config/types';
import type { Decimal } from '../core/BigNum';
import type { NewspaperState } from '../core/GameState';
import { Rng } from './Rng';

export interface Issue {
  day: number;
  /** День серии (1 — первый вход или серия прервалась). */
  streak: number;
  coins: Decimal;
  sardines: number;
  essence: number;
  /** Номера заголовков (news.h1…). */
  headlines: number[];
}

/**
 * Утренняя газета (SPEC §6): раз в сутки по времени платформы. Серия растёт, если заходить
 * каждый день; пропуск дня начинает серию заново.
 */
export class Newspaper {
  constructor(readonly cfg: NewspaperConfig) {}

  dayOf(timeMs: number): number {
    return Math.floor(timeMs / this.cfg.dayMs);
  }

  /** Выпуск на сегодня или null, если сегодняшний уже получен (или часы ушли назад). */
  issue(state: NewspaperState, timeMs: number, cps: Decimal, coinValue: Decimal): Issue | null {
    const day = this.dayOf(timeMs);
    if (day <= state.lastDay) return null;
    const streak = day === state.lastDay + 1 ? state.streak + 1 : 1;
    const i = Math.min(streak, this.cfg.rewardCpsSec.length) - 1;
    const pick = (arr: readonly number[]): number => arr[Math.min(i, arr.length - 1)] ?? 0;
    const fromCps = cps.mul(pick(this.cfg.rewardCpsSec));
    const floor = coinValue.mul(this.cfg.minCoinUnits);
    return {
      day,
      streak,
      coins: fromCps.gt(floor) ? fromCps : floor,
      sardines: pick(this.cfg.sardines),
      essence: pick(this.cfg.essence),
      headlines: this.headlines(day),
    };
  }

  /** Заголовки выпуска: детерминированы по дню, без повторов. */
  headlines(day: number): number[] {
    const rng = new Rng(day * 7919 + 13);
    const pool = Array.from({ length: this.cfg.headlines }, (_, k) => k + 1);
    const out: number[] = [];
    while (out.length < this.cfg.perIssue && pool.length > 0) {
      out.push(pool.splice(rng.int([0, pool.length - 1]), 1)[0]!);
    }
    return out;
  }
}
