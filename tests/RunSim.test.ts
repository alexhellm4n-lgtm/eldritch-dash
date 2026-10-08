import { describe, expect, it } from 'vitest';
import { enemiesConfig, runConfig } from '../src/config';
import { RunSim } from '../src/systems/RunSim';

const DT = 1 / 60;

/** Простейший «игрок»: прыгает перед препятствиями и под летающими врагами. */
function autopilot(sim: RunSim): void {
  const hero = sim.hero;
  const front = hero.x + runConfig.hero.width / 2;
  let wantJump = false;
  for (const e of sim.entities) {
    const dist = e.x - e.w / 2 - front;
    if (e.kind === 'obstacle' && !e.spent && dist > 0 && dist < 90) wantJump = true;
    if (e.kind === 'enemy' && enemiesConfig[e.type]?.behavior === 'flyer' && dist > 0 && dist < 160)
      wantJump = true;
  }
  if (wantJump && hero.grounded) sim.press();
  else if (!hero.grounded && hero.vy > 0) sim.release();
}

function run(sim: RunSim, sec: number, each?: (sim: RunSim) => void): void {
  for (let t = 0; t < sec; t += DT) {
    each?.(sim);
    sim.update(DT);
  }
}

describe('RunSim', () => {
  it('2 минуты активной игры: монеты, убийства, перепрыгнутые препятствия', () => {
    const sim = new RunSim({ seed: 42 });
    run(sim, 120, autopilot);
    expect(sim.earned.toNumber()).toBeGreaterThan(100);
    expect(sim.stats.kills).toBeGreaterThan(10);
    expect(sim.stats.cleared).toBeGreaterThan(5);
    expect(sim.stats.cleared).toBeGreaterThan(sim.stats.stuns);
    expect(Number.isFinite(sim.hero.x)).toBe(true);
  });

  it('бездействие не ломает забег: оглушения есть, бег продолжается', () => {
    const sim = new RunSim({ seed: 7 });
    run(sim, 60);
    expect(sim.stats.stuns).toBeGreaterThan(0);
    expect(sim.meters).toBeGreaterThan(100);
  });

  it('стартовый отрезок без опасностей', () => {
    const sim = new RunSim({ seed: 1 });
    sim.update(DT);
    const hazards = sim.entities.filter((e) => e.kind !== 'coin' && e.x < 900);
    expect(hazards).toHaveLength(0);
  });

  it('детерминированность по seed', () => {
    const a = new RunSim({ seed: 123 });
    const b = new RunSim({ seed: 123 });
    run(a, 30, autopilot);
    run(b, 30, autopilot);
    expect(a.earned.toString()).toBe(b.earned.toString());
    expect(a.stats).toEqual(b.stats);
  });

  it('пул объектов не растёт бесконечно', () => {
    const sim = new RunSim({ seed: 5 });
    run(sim, 60, autopilot);
    const created = sim.pool.created;
    run(sim, 240, autopilot);
    expect(sim.pool.created).toBeLessThan(created * 1.5);
    expect(sim.entities.length).toBeLessThan(200);
  });

  it('rebase держит координаты маленькими, дистанция копится', () => {
    const run2 = { ...runConfig, world: { ...runConfig.world, rebaseAtPx: 5000 } };
    const sim = new RunSim({ seed: 9, run: run2 });
    let rebases = 0;
    sim.bus.on('rebase', () => rebases++);
    let prevDist = 0;
    run(sim, 60, (s) => {
      expect(s.distancePx).toBeGreaterThanOrEqual(prevDist);
      prevDist = s.distancePx;
      autopilot(s);
    });
    expect(rebases).toBeGreaterThan(2);
    expect(sim.hero.x).toBeLessThanOrEqual(5000 + runConfig.hero.maxSpeed * runConfig.maxStepSec);
    expect(sim.distancePx).toBeGreaterThan(5000 * rebases);
  });

  it('огромный dt ограничивается (вкладка была в фоне)', () => {
    const sim = new RunSim({ seed: 2 });
    sim.update(60);
    expect(sim.hero.x).toBeLessThanOrEqual(runConfig.hero.maxSpeed * runConfig.maxStepSec);
  });
});
