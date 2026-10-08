import type { PhaseConfig, StarsConfig } from '../config/types';
import { Rng, WeightedTable } from './Rng';

export interface PhaseInfo {
  id: string;
  cfg: PhaseConfig;
  /** Номер слота: floor(время / периода). */
  slot: number;
  /** Секунд до смены фазы. */
  secondsLeft: number;
}

/**
 * «Положение звёзд» (SPEC §4.5): фаза определяется только временем — номер слота хешируется
 * в seed, из которого взвешенно выбирается фаза. Поэтому расписание одинаково у всех,
 * его можно прогнозировать и честно учитывать в офлайне.
 */
export class Stars {
  private readonly table: WeightedTable<string>;

  constructor(readonly cfg: StarsConfig) {
    const weights: Record<string, number> = {};
    for (const [id, p] of Object.entries(cfg.phases)) weights[id] = p.weight;
    this.table = new WeightedTable(weights);
  }

  slotAt(nowMs: number): number {
    return Math.floor(nowMs / 1000 / this.cfg.periodSec);
  }

  phaseForSlot(slot: number): string {
    // Хеш номера слота → seed; соседние слоты дают независимые фазы.
    let h = (slot | 0) ^ 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return this.table.pick(new Rng((h ^ (h >>> 16)) >>> 0));
  }

  at(nowMs: number): PhaseInfo {
    const slot = this.slotAt(nowMs);
    const id = this.phaseForSlot(slot);
    const end = (slot + 1) * this.cfg.periodSec * 1000;
    return { id, cfg: this.cfg.phases[id]!, slot, secondsLeft: (end - nowMs) / 1000 };
  }

  /** Прогноз: фаза следующего слота. */
  next(nowMs: number): string {
    return this.phaseForSlot(this.slotAt(nowMs) + 1);
  }

  /**
   * Средний множитель номинала монет за интервал (для офлайн-дохода): фазы честно «тикают»
   * и офлайн — считаем, сколько времени каждая длилась.
   */
  averageCoinMult(fromMs: number, toMs: number): number {
    if (toMs <= fromMs) return 1;
    const periodMs = this.cfg.periodSec * 1000;
    let sum = 0;
    let t = fromMs;
    while (t < toMs) {
      const slot = this.slotAt(t);
      const end = Math.min(toMs, (slot + 1) * periodMs);
      const phase = this.cfg.phases[this.phaseForSlot(slot)]!;
      sum += (end - t) * (phase.coinValueMult ?? 1);
      t = end;
    }
    return sum / (toMs - fromMs);
  }
}
