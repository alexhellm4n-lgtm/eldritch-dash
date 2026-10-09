import { describe, expect, it } from 'vitest';
import {
  biomesConfig,
  enemiesConfig,
  progressionConfig,
  runConfig,
  type BiomeConfig,
  type ProgressionConfig,
} from '../src/config';
import type { Entity } from '../src/systems/Entity';
import { RunSim } from '../src/systems/RunSim';

const DT = 1 / 60;

function autopilot(sim: RunSim): void {
  const hero = sim.hero;
  const front = hero.x + runConfig.hero.width / 2;
  let jump = false;
  for (const e of sim.entities) {
    const d = e.x - e.w / 2 - front;
    // Волны босса летят навстречу — прыгать раньше.
    const reach = e.vx < 0 ? 150 : 90;
    if (e.kind === 'obstacle' && !e.spent && d > 0 && d < reach) jump = true;
    if (e.kind === 'enemy' && enemiesConfig[e.type]?.behavior === 'flyer' && d > 0 && d < 160) {
      jump = true;
    }
  }
  if (jump && hero.grounded) sim.press();
  else if (!hero.grounded && hero.vy > 0) sim.release();
}

function run(sim: RunSim, sec: number, each?: (sim: RunSim) => void): void {
  for (let t = 0; t < sec; t += DT) {
    each?.(sim);
    sim.update(DT);
  }
}

/** Короткие биомы без мини-боссов: до босса — 300 м. */
function shortBiomes(patch: Partial<BiomeConfig> = {}): Record<string, BiomeConfig> {
  const out: Record<string, BiomeConfig> = {};
  for (const [id, b] of Object.entries(biomesConfig)) {
    out[id] = { ...b, lengthM: 300, miniBoss: { ...b.miniBoss, chance: 0 }, ...patch };
  }
  return out;
}

function withBoss(patch: Partial<ProgressionConfig['bosses'][string]>): ProgressionConfig {
  const bosses: ProgressionConfig['bosses'] = {};
  for (const [id, b] of Object.entries(progressionConfig.bosses)) bosses[id] = { ...b, ...patch };
  return { ...progressionConfig, bosses };
}

describe('биомы и боссы', () => {
  it('в конце биома выходит босс; победа над ним — награда и следующий биом', () => {
    const sim = new RunSim({ seed: 5, biomes: shortBiomes() });
    const defeats: string[] = [];
    const changes: string[] = [];
    let spawned: Entity | null = null;
    sim.bus.on('bossSpawn', (e) => (spawned = e));
    sim.bus.on('bossDefeated', (b) => {
      defeats.push(b.id);
      expect(b.coins.gt(0)).toBe(true);
      expect(b.essence).toBeGreaterThan(0);
    });
    sim.bus.on('biomeChange', (id) => changes.push(id));
    run(sim, 200, (s) => {
      autopilot(s);
      if (changes.length > 0) return;
    });
    expect(spawned).not.toBeNull();
    expect(defeats[0]).toBe('reefKeeper');
    expect(changes[0]).toBe('forest');
    expect(sim.biomeId).not.toBe('coast');
    expect(sim.stats.bossKills).toBeGreaterThanOrEqual(1);
  });

  it('пока идёт бой, путь по биому стоит, а трасса без опасностей', () => {
    const sim = new RunSim({
      seed: 9,
      biomes: shortBiomes(),
      progressM: 300,
      progression: withBoss({ hp: 9999 }),
    });
    run(sim, 8);
    expect(sim.boss).not.toBeNull();
    const before = sim.biomeProgressM;
    run(sim, 5);
    expect(sim.biomeProgressM).toBe(before);
    // Новые паттерны во время боя — только монеты и пикапы (волны и призыв — от босса).
    const ahead = sim.entities.filter(
      (e) => e.x > sim.hero.x + 1200 && e.kind === 'obstacle' && e.vx === 0,
    );
    expect(ahead).toHaveLength(0);
  });

  it('босс подлетает в зону вспышки и снова отходит', () => {
    const sim = new RunSim({
      seed: 3,
      biomes: shortBiomes(),
      progressM: 300,
      progression: withBoss({ hp: 9999 }),
    });
    let minGap = Infinity;
    let maxGap = 0;
    run(sim, 20, (s) => {
      const b = s.boss;
      if (!b || s.bossTime < progressionConfig.bossEntrySec) return;
      const gap = b.x - s.hero.x;
      minGap = Math.min(minGap, gap);
      maxGap = Math.max(maxGap, gap);
    });
    const cfg = progressionConfig.bosses.reefKeeper!;
    expect(minGap).toBeLessThan(cfg.exposePx + 1);
    expect(maxGap).toBeGreaterThan(cfg.holdPx - 1);
    expect(sim.boss!.hp).toBeLessThan(9999);
  });

  it('не успели победить — босс уходит, путь откатывается, потом он возвращается', () => {
    const sim = new RunSim({
      seed: 11,
      biomes: shortBiomes(),
      progressM: 300,
      progression: withBoss({ hp: 9999, fightSec: 6 }),
    });
    let escaped = 0;
    let spawns = 0;
    sim.bus.on('bossEscaped', () => escaped++);
    sim.bus.on('bossSpawn', () => spawns++);
    run(sim, 9, autopilot);
    expect(escaped).toBe(1);
    expect(sim.boss).toBeNull();
    expect(sim.biomeProgressM).toBeLessThan(300);
    expect(sim.biomeProgressM).toBeGreaterThanOrEqual(300 * 0.85 - 1);
    run(sim, 30, autopilot);
    expect(spawns).toBeGreaterThanOrEqual(2);
  });

  it('после финального босса — новый круг с побережья, монеты дороже', () => {
    const sim = new RunSim({
      seed: 2,
      biome: 'sunken',
      biomes: shortBiomes(),
      progressM: 300,
      progression: withBoss({ hp: 1 }),
    });
    const mult0 = sim.coinMult / sim.biome.coinMult;
    const changes: string[] = [];
    sim.bus.on('biomeChange', (id) => changes.push(id));
    run(sim, 30, autopilot);
    expect(changes[0]).toBe('coast');
    expect(sim.lap).toBe(1);
    const mult1 = sim.coinMult / sim.biome.coinMult;
    expect(mult1).toBeGreaterThan(mult0);
  });

  it('мини-босс: крупнее, крепче, всегда оставляет сундук', () => {
    const biomes = shortBiomes({ lengthM: 100000 });
    for (const b of Object.values(biomes)) b.miniBoss = { ...b.miniBoss, everyM: 80, chance: 1 };
    const sim = new RunSim({ seed: 4, biomes });
    const elites: Entity[] = [];
    let eliteKills = 0;
    let chestsAfterElite = 0;
    let lastKillElite = false;
    sim.bus.on('eliteSpawn', (e) => {
      elites.push(e);
      const base = enemiesConfig[e.type]!;
      expect(e.scale).toBeGreaterThan(1);
      expect(e.w).toBeCloseTo(base.width * e.scale);
      expect(e.hp).toBe(Math.ceil(base.hp * biomes.coast!.miniBoss.hpMult));
    });
    sim.bus.on('kill', (e) => {
      lastKillElite = e.elite;
      if (e.elite) eliteKills++;
    });
    sim.bus.on('chest', () => {
      if (lastKillElite) chestsAfterElite++;
      lastKillElite = false;
    });
    run(sim, 60, autopilot);
    expect(elites.length).toBeGreaterThan(3);
    expect(eliteKills).toBeGreaterThan(0);
    expect(chestsAfterElite).toBe(eliteKills);
    expect(sim.stats.miniBossKills).toBe(eliteKills);
  });

  it('корнеход: под землёй неуязвим, вылезает рядом с героем', () => {
    const forest = { ...biomesConfig.forest!, enemyWeights: { rootCrawler: 1 } };
    const sim = new RunSim({ seed: 8, biome: 'forest', biomes: { ...biomesConfig, forest } });
    const emerge = enemiesConfig.rootCrawler!.emergePx!;
    const gaps: number[] = [];
    sim.bus.on('emerge', (e) => gaps.push(e.x - sim.hero.x));
    let hitWhileBurrowed = false;
    run(sim, 30, (s) => {
      for (const e of s.entities) {
        if (e.type === 'rootCrawler' && e.burrowed && e.hp < enemiesConfig.rootCrawler!.hp) {
          hitWhileBurrowed = true;
        }
      }
    });
    expect(gaps.length).toBeGreaterThan(0);
    for (const g of gaps) expect(g).toBeLessThanOrEqual(emerge);
    expect(hitWhileBurrowed).toBe(false);
  });

  it('неправильный куб перескакивает между землёй и высотой', () => {
    const sunken = { ...biomesConfig.sunken!, enemyWeights: { wrongCube: 1 } };
    const sim = new RunSim({ seed: 6, biome: 'sunken', biomes: { ...biomesConfig, sunken } });
    const cfg = enemiesConfig.wrongCube!;
    const ground = runConfig.world.groundY - cfg.height / 2;
    const air = runConfig.world.groundY - cfg.altitude!;
    let sawGround = false;
    let sawAir = false;
    run(sim, 20, (s) => {
      for (const e of s.entities) {
        if (e.type !== 'wrongCube' || e.t < 0.1) continue;
        if (Math.abs(e.y - ground) < 4) sawGround = true;
        if (Math.abs(e.y - air) < 4) sawAir = true;
      }
    });
    expect(sawGround).toBe(true);
    expect(sawAir).toBe(true);
  });

  it('прогресс по биому продолжается с сохранённого места', () => {
    const sim = new RunSim({ seed: 1, biome: 'forest', progressM: 1234, lap: 2 });
    expect(sim.biomeId).toBe('forest');
    expect(sim.biomeProgressM).toBe(1234);
    expect(sim.lap).toBe(2);
    run(sim, 5);
    expect(sim.biomeProgressM).toBeGreaterThan(1234);
  });
});
