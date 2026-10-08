import type { ComboConfig } from '../config/types';

/** Серия без столкновений → множитель монет по ступеням из economy.json. */
export class Combo {
  streak = 0;
  multiplier = 1;

  constructor(private readonly cfg: ComboConfig) {
    this.recalc();
  }

  add(n: number): void {
    this.streak += n;
    this.recalc();
  }

  reset(): void {
    this.streak = 0;
    this.recalc();
  }

  private recalc(): void {
    let mult = 1;
    for (const step of this.cfg.steps) {
      if (this.streak >= step.streak) mult = step.multiplier;
    }
    this.multiplier = Math.min(mult, this.cfg.maxMultiplier);
  }
}
