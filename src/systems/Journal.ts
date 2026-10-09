import type { JournalConfig, RunModifiers } from '../config/types';
import { applyEffect } from './Upgrades';

export type EntryState = 'unknown' | 'partial' | 'full';

/**
 * Дневник исследователя (SPEC §6): карточка на каждую тварь. Встреча = победа над тварью
 * (иллюзии не считаются). Полная запись после N встреч даёт постоянный бонус.
 */
export class Journal {
  private readonly bosses: ReadonlySet<string>;

  constructor(readonly cfg: JournalConfig) {
    this.bosses = new Set(cfg.bosses);
  }

  has(id: string): boolean {
    return this.cfg.creatures.includes(id);
  }

  isBoss(id: string): boolean {
    return this.bosses.has(id);
  }

  needed(id: string): number {
    return this.isBoss(id) ? this.cfg.bossFullAt : this.cfg.fullAt;
  }

  state(id: string, counts: Readonly<Record<string, number>>): EntryState {
    const n = counts[id] ?? 0;
    if (n <= 0) return 'unknown';
    return n >= this.needed(id) ? 'full' : 'partial';
  }

  /** Сколько тварей уже встречено и сколько записей полные. */
  discovered(counts: Readonly<Record<string, number>>): number {
    return this.cfg.creatures.filter((id) => (counts[id] ?? 0) > 0).length;
  }

  fullCount(counts: Readonly<Record<string, number>>): number {
    return this.cfg.creatures.filter((id) => this.state(id, counts) === 'full').length;
  }

  modifiers(counts: Readonly<Record<string, number>>, into: RunModifiers): RunModifiers {
    applyEffect(into, this.cfg.bonusPerFull, this.fullCount(counts));
    return into;
  }
}
