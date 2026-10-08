import type { Range } from '../config/types';

/** Детерминированный PRNG (mulberry32): одинаковый seed → одинаковая трасса в тестах и симуляторе. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  /** [0, 1) */
  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Вещественное в [min, max). */
  range(r: Range): number {
    return r[0] + (r[1] - r[0]) * this.next();
  }

  /** Целое в [min, max] включительно. */
  int(r: Range): number {
    return r[0] + Math.floor((r[1] - r[0] + 1) * this.next());
  }

  chance(p: number): boolean {
    return this.next() < p;
  }
}

/** Взвешенный выбор без аллокаций на каждом вызове. */
export class WeightedTable<K extends string> {
  private readonly keys: K[];
  private readonly cumulative: number[];
  private readonly total: number;

  constructor(weights: Readonly<Record<K, number>>) {
    this.keys = [];
    this.cumulative = [];
    let sum = 0;
    for (const key of Object.keys(weights) as K[]) {
      const w = weights[key];
      if (w <= 0) continue;
      sum += w;
      this.keys.push(key);
      this.cumulative.push(sum);
    }
    if (this.keys.length === 0) throw new Error('WeightedTable: нет положительных весов');
    this.total = sum;
  }

  pick(rng: Rng): K {
    const roll = rng.next() * this.total;
    for (let i = 0; i < this.cumulative.length; i++) {
      if (roll < this.cumulative[i]!) return this.keys[i]!;
    }
    return this.keys[this.keys.length - 1]!;
  }
}
