import { describe, expect, it } from 'vitest';
import {
  economyConfig,
  enemiesConfig,
  runConfig,
  sanityConfig,
  upgradesConfig,
} from '../src/config';
import { coinMultFor } from '../src/systems/Sanity';
import { bn } from '../src/core/BigNum';
import { createGameState } from '../src/core/GameState';
import { GameSession } from '../src/systems/GameSession';
import { RunSim } from '../src/systems/RunSim';

const DT = 1 / 60;

function session(coins = 0): GameSession {
  return new GameSession(createGameState(0, coins));
}

function autopilot(sim: RunSim): void {
  const hero = sim.hero;
  const front = hero.x + runConfig.hero.width / 2;
  let jump = false;
  for (const e of sim.entities) {
    const d = e.x - e.w / 2 - front;
    if (e.kind === 'obstacle' && !e.spent && d > 0 && d < 90) jump = true;
    if (e.kind === 'enemy' && enemiesConfig[e.type]?.behavior === 'flyer' && d > 0 && d < 160)
      jump = true;
  }
  if (jump && hero.grounded) sim.press();
  else if (!hero.grounded && hero.vy > 0) sim.release();
}

describe('GameSession', () => {
  it('покупка снаряжения списывает дублоны и даёт CpS', () => {
    const s = session(100);
    expect(s.buyItem('fisher', 1)).toBe(true);
    expect(s.state.coins.toNumber()).toBeCloseTo(85);
    expect(s.cps.toNumber()).toBeCloseTo(0.5);
    expect(s.buyItem('star_altar', 1)).toBe(false);
  });

  it('×10 и MAX', () => {
    const s = session(1e6);
    const q10 = s.quoteItem('fisher', 10);
    expect(q10.count).toBe(10);
    s.buyItem('fisher', 10);
    expect(s.itemLevel('fisher')).toBe(10);
    const max = s.quoteItem('bookbinder', 'max');
    s.buyItem('bookbinder', 'max');
    expect(s.itemLevel('bookbinder')).toBe(max.count);
    expect(s.quoteItem('bookbinder', 1).affordable).toBe(false);
  });

  it('улучшение героя меняет модификаторы забега', () => {
    const s = session(1e9);
    const sim = new RunSim({ seed: 1 });
    s.attachRun(sim);
    expect(sim.hero.maxJumps).toBe(1);
    expect(s.buyHero('doubleJump')).toBe(true);
    expect(sim.hero.maxJumps).toBe(2);
    expect(s.buyHero('doubleJump')).toBe(false);
    s.buyHero('coinValue');
    expect(sim.coinValue.toNumber()).toBeCloseTo(2);
  });

  it('пассивный доход тикает по CpS', () => {
    const st = createGameState(0);
    st.items.fisher = 10;
    const s = new GameSession(st);
    for (let i = 0; i < 60; i++) s.tick(1);
    expect(s.state.coins.toNumber()).toBeCloseTo(10 * 0.5 * 60, 6);
    expect(s.state.stats.playtimeSec).toBe(60);
  });

  it('офлайн: отчёт, забор ×1 и ×2', () => {
    const st = createGameState(0);
    st.items.fisher = 20;
    st.lastSeen = 0;
    const s = new GameSession(st);
    const r = s.checkOffline(3600 * 1000)!;
    // Пассивный режим: рассудок idleSanity (×1.3) и средняя фаза звёзд за час.
    const idle = coinMultFor(sanityConfig.idleSanity, sanityConfig);
    const phase = s.stars.averageCoinMult(0, 3600 * 1000);
    expect(r.amount.toNumber()).toBeCloseTo(
      20 * 0.5 * 3600 * economyConfig.offline.rate * idle * phase,
      3,
    );
    expect(s.claimOffline(2).toNumber()).toBeCloseTo(r.amount.toNumber() * 2);
    expect(s.pendingOffline).toBeNull();
    expect(s.claimOffline().toNumber()).toBe(0);
  });

  it('награды забега зачисляются в кошелёк', () => {
    const s = session();
    const sim = new RunSim({ seed: 3 });
    s.attachRun(sim);
    for (let t = 0; t < 20; t += DT) {
      autopilot(sim);
      sim.update(DT);
    }
    expect(s.state.coins.toString()).toBe(sim.earned.toString());
    expect(s.state.coinsThisDive.gt(0)).toBe(true);
  });

  it('SPEC §17: первая покупка ≤ 10 с активной игры', () => {
    const fisher = upgradesConfig.items[0]!;
    for (const seed of [1, 2, 3, 42, 99, 1234, 777, 31337]) {
      const s = session(economyConfig.startCoins);
      const sim = new RunSim({ seed });
      s.attachRun(sim);
      let t = 0;
      while (s.state.coins.lt(fisher.base) && t < 60) {
        autopilot(sim);
        sim.update(DT);
        s.tick(DT);
        t += DT;
      }
      expect(t, `seed ${seed}`).toBeLessThanOrEqual(10);
    }
  });

  it('номинал монеты растёт с CpS', () => {
    const s = session(bn(1e9).toNumber());
    const before = s.coinValue.toNumber();
    s.buyItem('bookbinder', 10);
    expect(s.coinValue.toNumber()).toBeGreaterThan(before);
  });
});
