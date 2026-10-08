import { describe, expect, it } from 'vitest';
import {
  biomesConfig,
  economyConfig,
  ENEMY_BEHAVIORS,
  enemiesConfig,
  PATTERNS,
  runConfig,
} from '../src/config';

describe('конфиги', () => {
  it('враги: допустимое поведение и обязательные поля', () => {
    for (const [id, e] of Object.entries(enemiesConfig)) {
      expect(ENEMY_BEHAVIORS, id).toContain(e.behavior);
      expect(e.hp, id).toBeGreaterThanOrEqual(1);
      if (e.behavior === 'flyer') expect(e.altitude, id).toBeGreaterThan(0);
      if (e.behavior === 'hopper') expect(e.hopPeriodSec, id).toBeGreaterThan(0);
      if (e.hp > 1) expect(e.knockback, id).toBeGreaterThan(0);
    }
  });

  it('биомы ссылаются только на существующих врагов и препятствия', () => {
    for (const [id, b] of Object.entries(biomesConfig)) {
      for (const k of Object.keys(b.patternWeights)) expect(PATTERNS, id).toContain(k);
      for (const k of Object.keys(b.enemyWeights)) expect(enemiesConfig, id).toHaveProperty(k);
      for (const k of Object.keys(b.obstacleWeights)) expect(b.obstacles, id).toHaveProperty(k);
      expect(b.gapPx[0]).toBeLessThanOrEqual(b.gapPx[1]);
      expect(b.parallax).toHaveLength(4);
    }
  });

  it('ступени комбо возрастают, множитель до ×2', () => {
    const steps = economyConfig.combo.steps;
    expect(steps[0]).toEqual({ streak: 0, multiplier: 1 });
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.streak).toBeGreaterThan(steps[i - 1]!.streak);
      expect(steps[i]!.multiplier).toBeGreaterThan(steps[i - 1]!.multiplier);
    }
    expect(economyConfig.combo.maxMultiplier).toBe(2);
  });

  it('прыжок перепрыгивает любое препятствие, но летающих с земли не достать', () => {
    const { hero, attack } = runConfig;
    const peak = hero.jumpVelocity ** 2 / (2 * hero.gravity);
    for (const b of Object.values(biomesConfig)) {
      for (const o of Object.values(b.obstacles)) expect(peak).toBeGreaterThan(o.height * 1.5);
    }
    for (const e of Object.values(enemiesConfig)) {
      if (e.behavior !== 'flyer') continue;
      const bottom = e.altitude! - e.height / 2 - (e.bobAmp ?? 0);
      expect(bottom).toBeGreaterThan(Math.max(attack.height, hero.height));
      expect(peak + attack.height).toBeGreaterThan(e.altitude! + (e.bobAmp ?? 0));
    }
  });

  it('парение: базовая выносливость 1.5 с (SPEC §4.1)', () => {
    expect(runConfig.glide.staminaSec).toBe(1.5);
  });
});
