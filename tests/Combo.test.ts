import { describe, expect, it } from 'vitest';
import { economyConfig } from '../src/config';
import { Combo } from '../src/systems/Combo';

const steps = economyConfig.combo.steps;

describe('Combo', () => {
  it('множитель растёт по ступеням и сбрасывается', () => {
    const c = new Combo(economyConfig.combo);
    expect(c.multiplier).toBe(1);
    for (const s of steps) {
      c.reset();
      c.add(s.streak);
      expect(c.multiplier).toBe(s.multiplier);
    }
    c.reset();
    expect(c.streak).toBe(0);
    expect(c.multiplier).toBe(1);
  });

  it('множитель не выше капа ×2', () => {
    const c = new Combo({
      ...economyConfig.combo,
      steps: [...steps, { streak: 99, multiplier: 5 }],
    });
    c.add(1000);
    expect(c.multiplier).toBe(economyConfig.combo.maxMultiplier);
  });
});
