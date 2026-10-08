import { describe, expect, it } from 'vitest';
import { economyConfig, upgradesConfig } from '../src/config';
import { bn } from '../src/core/BigNum';
import { createGameState } from '../src/core/GameState';
import { Economy } from '../src/systems/Economy';
import { Upgrades } from '../src/systems/Upgrades';

const eco = new Economy(upgradesConfig, economyConfig);
const g = upgradesConfig.growth;

describe('Economy', () => {
  it('цена уровня: base × growth^n', () => {
    expect(eco.itemCost('fisher', 0, 1).toNumber()).toBeCloseTo(15);
    expect(eco.itemCost('fisher', 10, 1).toNumber()).toBeCloseTo(15 * g ** 10, 6);
  });

  it('оптовая цена равна сумме поштучных', () => {
    let sum = 0;
    for (let n = 3; n < 13; n++) sum += 15 * g ** n;
    expect(eco.itemCost('fisher', 3, 10).toNumber()).toBeCloseTo(sum, 6);
  });

  it('maxAffordable: столько, сколько реально хватает', () => {
    const coins = bn(1000);
    const n = eco.maxAffordable('fisher', 5, coins);
    expect(eco.itemCost('fisher', 5, n).lte(coins)).toBe(true);
    expect(eco.itemCost('fisher', 5, n + 1).gt(coins)).toBe(true);
    expect(eco.resolveAmount('fisher', 5, bn(0), 'max')).toBe(1);
  });

  it('вехи 25/50/100/200 удваивают доход предмета', () => {
    expect(eco.milestoneMultiplier(24)).toBe(1);
    expect(eco.milestoneMultiplier(25)).toBe(2);
    expect(eco.milestoneMultiplier(100)).toBe(8);
    expect(eco.milestoneMultiplier(200)).toBe(16);
    expect(eco.itemCps('fisher', 25).toNumber()).toBeCloseTo(25 * 0.5 * 2);
    expect(eco.nextMilestone(30)).toBe(50);
    expect(eco.nextMilestone(250)).toBeNull();
  });

  it('CpS суммирует снаряжение', () => {
    const s = createGameState(0);
    s.items = { fisher: 10, bookbinder: 2 };
    expect(eco.cps(s).toNumber()).toBeCloseTo(10 * 0.5 + 2 * 4);
  });

  it('номинал монеты = (1 + CpS × 0.15) × множители', () => {
    expect(eco.coinValue(bn(0), 1).toNumber()).toBe(1);
    expect(eco.coinValue(bn(100), 2).toNumber()).toBeCloseTo((1 + 15) * 2);
  });
});

describe('Upgrades', () => {
  const up = new Upgrades(upgradesConfig);

  it('без покупок — базовые модификаторы', () => {
    const m = up.modifiers({});
    expect(m.extraJumps).toBe(0);
    expect(m.coinValueMult).toBe(1);
    expect(m.attackRangeMult).toBe(1);
  });

  it('тиры складываются и перемножаются', () => {
    const m = up.modifiers({ flashRadius: 2, coinValue: 3, doubleJump: 1, glideStamina: 1 });
    expect(m.attackRangeMult).toBeCloseTo(1.5);
    expect(m.coinValueMult).toBe(8);
    expect(m.extraJumps).toBe(1);
    expect(m.staminaBonusSec).toBeCloseTo(0.5);
  });

  it('уровень выше максимального обрезается', () => {
    expect(up.modifiers({ doubleJump: 5 }).extraJumps).toBe(1);
    expect(up.nextCost('doubleJump', 1)).toBeNull();
  });
});
