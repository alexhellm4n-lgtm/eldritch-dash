import { describe, expect, it } from 'vitest';
import { Rng, WeightedTable } from '../src/systems/Rng';

describe('Rng', () => {
  it('детерминирован и в диапазоне [0, 1)', () => {
    const a = new Rng(1);
    const b = new Rng(1);
    for (let i = 0; i < 1000; i++) {
      const v = a.next();
      expect(v).toBe(b.next());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int включает обе границы', () => {
    const rng = new Rng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rng.int([2, 4]));
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });

  it('WeightedTable соблюдает веса и пропускает нулевые', () => {
    const rng = new Rng(11);
    const table = new WeightedTable({ a: 3, b: 1, c: 0 });
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 4000; i++) counts[table.pick(rng)]++;
    expect(counts.c).toBe(0);
    expect(counts.a / counts.b).toBeGreaterThan(2.5);
    expect(counts.a / counts.b).toBeLessThan(3.5);
  });
});
