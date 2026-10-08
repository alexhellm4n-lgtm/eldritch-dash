import type { SanityConfig } from '../config/types';

/**
 * Рассудок 0..max (SPEC §4.3): медленно убывает в забеге и от контакта с тварями,
 * восстанавливается фонарями и чаем. Чем ниже — тем выше множитель монет и тем страннее мир.
 */
export class Sanity {
  value: number;

  constructor(private readonly cfg: SanityConfig) {
    this.value = cfg.start;
  }

  get ratio(): number {
    return this.value / this.cfg.max;
  }

  /** Множитель монет: 1 + (max − рассудок) × coinMultPerPoint, с капом. */
  get coinMult(): number {
    return coinMultFor(this.value, this.cfg);
  }

  /** Сила искажений 0..1: 0 на пороге distortAt, 1 на нуле. */
  get distortion(): number {
    if (this.value >= this.cfg.distortAt) return 0;
    return 1 - this.value / this.cfg.distortAt;
  }

  get distorted(): boolean {
    return this.value < this.cfg.distortAt;
  }

  get hidesObstacles(): boolean {
    return this.value < this.cfg.invisibleAt;
  }

  /** Убывание за шаг; возвращает true, если рассудок только что упал до нуля. */
  drain(dt: number, mult: number): boolean {
    return this.lose(this.cfg.drainPerSec * mult * dt);
  }

  lose(amount: number): boolean {
    if (amount <= 0 || this.value <= 0) return false;
    this.value = Math.max(0, this.value - amount);
    return this.value === 0;
  }

  restore(amount: number): void {
    this.value = Math.min(this.cfg.max, this.value + Math.max(0, amount));
  }

  set(value: number): void {
    this.value = Math.max(0, Math.min(this.cfg.max, value));
  }
}

export function coinMultFor(sanity: number, cfg: SanityConfig): number {
  return Math.min(1 + (cfg.max - sanity) * cfg.coinMultPerPoint, cfg.coinMultCap);
}
