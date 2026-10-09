import { describe, expect, it } from 'vitest';
import {
  achievementsConfig,
  biomesConfig,
  enemiesConfig,
  journalConfig,
  newspaperConfig,
  progressionConfig,
  sanityConfig,
  townConfig,
} from '../src/config';
import { bn } from '../src/core/BigNum';
import { createGameState } from '../src/core/GameState';
import { decodeSave } from '../src/save/SaveManager';
import { ACHIEVEMENT_STATS, Achievements } from '../src/systems/Achievements';
import { Entity } from '../src/systems/Entity';
import { GameSession } from '../src/systems/GameSession';
import { HINT_IDS, HintWatcher, type HintId } from '../src/systems/Hints';
import { Newspaper } from '../src/systems/Newspaper';
import { RunSim } from '../src/systems/RunSim';

const DAY = newspaperConfig.dayMs;

function killEvent(sim: RunSim, type: string, elite = false): void {
  const e = new Entity().reset(1, 'enemy', type);
  e.elite = elite;
  sim.bus.emit('kill', e);
}

describe('городок', () => {
  it('постройка за дублоны: уровень, растущая цена, бонус к номиналу монеты', () => {
    const st = createGameState(0);
    st.coins = bn(1e9);
    const s = new GameSession(st);
    const value0 = s.coinValue.toNumber();
    const c0 = s.buildingCost('lighthouse')!;
    expect(s.buyBuilding('lighthouse')).toBe(true);
    expect(s.buildingLevel('lighthouse')).toBe(1);
    expect(s.buildingCost('lighthouse')!.gt(c0)).toBe(true);
    expect(s.coinValue.toNumber()).toBeGreaterThan(value0);
    expect(s.state.coins.toNumber()).toBeCloseTo(1e9 - c0.toNumber());
  });

  it('нет денег или максимум уровня — покупки нет', () => {
    const st = createGameState(0);
    const s = new GameSession(st);
    expect(s.buyBuilding('lighthouse')).toBe(false);
    st.coins = bn('1e100');
    const max = townConfig.buildings.find((b) => b.id === 'chapel')!.maxLevel;
    for (let i = 0; i < max; i++) expect(s.buyBuilding('chapel')).toBe(true);
    expect(s.buildingCost('chapel')).toBeNull();
    expect(s.buyBuilding('chapel')).toBe(false);
  });

  it('туман над городком рассеивается с уровнем маяка', () => {
    const s = new GameSession(createGameState(0));
    expect(s.town.fogCleared({})).toBe(0);
    expect(s.town.fogCleared({ lighthouse: townConfig.fogClearLevel })).toBe(1);
  });
});

describe('дневник', () => {
  it('встречи считаются по победам; первая — новая запись, N-я — полная с бонусом', () => {
    const s = new GameSession(createGameState(0));
    const sim = new RunSim({ seed: 1 });
    s.attachRun(sim);
    const news: string[] = [];
    const full: string[] = [];
    s.bus.on('journalNew', (id) => news.push(id));
    s.bus.on('journalFull', (id) => full.push(id));
    const value0 = s.coinValue.toNumber();
    for (let i = 0; i < journalConfig.fullAt; i++) killEvent(sim, 'fishman');
    expect(news).toEqual(['fishman']);
    expect(full).toEqual(['fishman']);
    expect(s.state.journal.fishman).toBe(journalConfig.fullAt);
    expect(s.coinValue.toNumber()).toBeGreaterThan(value0);
  });

  it('босс: полная запись после нескольких побед', () => {
    const s = new GameSession(createGameState(0));
    const sim = new RunSim({ seed: 1 });
    s.attachRun(sim);
    for (let i = 0; i < journalConfig.bossFullAt; i++) {
      sim.bus.emit('bossDefeated', {
        id: 'reefKeeper',
        x: 0,
        y: 0,
        coins: bn(10),
        essence: 5,
        sardines: 2,
      });
    }
    expect(s.journal.state('reefKeeper', s.state.journal)).toBe('full');
    expect(s.state.world.bosses.reefKeeper).toBe(journalConfig.bossFullAt);
    expect(s.state.sardines).toBe(2 * journalConfig.bossFullAt);
  });
});

describe('достижения', () => {
  it('выполненные тиры выдаются один раз и дают +1 % к доходу', () => {
    const st = createGameState(0);
    st.items.fisher = 5;
    st.stats.kills = 150;
    const s = new GameSession(st);
    const cps0 = s.cps.toNumber();
    const got: string[] = [];
    s.bus.on('achievement', (a) => got.push(a.id));
    s.checkAchievements();
    expect(got.sort()).toEqual(['kills_1', 'kills_2']);
    expect(s.cps.toNumber()).toBeCloseTo(cps0 * (1 + 2 * achievementsConfig.bonusPerAchievement));
    s.checkAchievements();
    expect(got).toHaveLength(2);
  });

  it('50+ достижений, все показатели известны', () => {
    const a = new Achievements(achievementsConfig);
    expect(a.list.length).toBeGreaterThanOrEqual(50);
    for (const g of achievementsConfig.groups) {
      expect(ACHIEVEMENT_STATS as readonly string[]).toContain(g.stat);
      for (let i = 1; i < g.tiers.length; i++) expect(g.tiers[i]!).toBeGreaterThan(g.tiers[i - 1]!);
    }
  });
});

describe('утренняя газета', () => {
  const paper = new Newspaper(newspaperConfig);
  const cps = bn(10);
  const coin = bn(1);

  it('серия растёт день за днём и сбрасывается после пропуска', () => {
    const day = 20000;
    const first = paper.issue({ lastDay: 0, streak: 0 }, day * DAY + 5, cps, coin)!;
    expect(first.streak).toBe(1);
    const next = paper.issue({ lastDay: day, streak: 1 }, (day + 1) * DAY + 5, cps, coin)!;
    expect(next.streak).toBe(2);
    const skipped = paper.issue({ lastDay: day, streak: 5 }, (day + 3) * DAY, cps, coin)!;
    expect(skipped.streak).toBe(1);
  });

  it('в тот же день и при переводе часов назад газеты нет', () => {
    expect(paper.issue({ lastDay: 100, streak: 2 }, 100 * DAY + 999, cps, coin)).toBeNull();
    expect(paper.issue({ lastDay: 100, streak: 2 }, 50 * DAY, cps, coin)).toBeNull();
  });

  it('награда растёт до седьмого дня, заголовки без повторов и стабильны', () => {
    const a = paper.issue({ lastDay: 9, streak: 0 }, 10 * DAY, cps, coin)!;
    const b = paper.issue({ lastDay: 9, streak: 6 }, 10 * DAY, cps, coin)!;
    const c = paper.issue({ lastDay: 9, streak: 40 }, 10 * DAY, cps, coin)!;
    expect(b.coins.gt(a.coins)).toBe(true);
    expect(c.coins.eq(b.coins)).toBe(true);
    expect(new Set(a.headlines).size).toBe(newspaperConfig.perIssue);
    expect(paper.headlines(10)).toEqual(a.headlines);
  });

  it('без дохода награда не меньше минимума', () => {
    const i = paper.issue({ lastDay: 0, streak: 0 }, 5 * DAY, bn(0), bn(3))!;
    expect(i.coins.toNumber()).toBe(3 * newspaperConfig.minCoinUnits);
  });

  it('сессия: забрать выпуск — деньги, серия, второй раз за день нельзя', () => {
    const s = new GameSession(createGameState(0));
    const issue = s.checkNewspaper(7 * DAY)!;
    s.claimNewspaper();
    expect(s.state.newspaper).toEqual({ lastDay: 7, streak: 1 });
    expect(s.state.coins.gte(issue.coins)).toBe(true);
    expect(s.checkNewspaper(7 * DAY + 100)).toBeNull();
  });
});

describe('подсказки', () => {
  it('очередь без повторов; показанная подсказка запоминается в сохранении', () => {
    const s = new GameSession(createGameState(0));
    s.queueHint('stun');
    s.queueHint('stun');
    s.queueHint('page');
    expect(s.takeHint()).toBe('stun');
    expect(s.takeHint()).toBe('page');
    expect(s.takeHint()).toBeNull();
    s.queueHint('stun');
    expect(s.takeHint()).toBeNull();
    expect(s.state.hints).toEqual(['stun', 'page']);
  });

  it('события забега и опрос ставят нужные подсказки', () => {
    const queued: HintId[] = [];
    const w = new HintWatcher({ queueHint: (id) => queued.push(id) }, enemiesConfig, sanityConfig);
    const sim = new RunSim({ seed: 1 });
    w.attach(sim);
    sim.bus.emit('page', 1);
    sim.sanity.set(sanityConfig.invisibleAt - 1);
    w.poll({ grimoireAffordable: true, canDive: false, townAffordable: false });
    expect(queued).toEqual(
      expect.arrayContaining(['page', 'sanity', 'distortion', 'hidden', 'grimoire']),
    );
    expect(queued).not.toContain('dive');
    w.detach();
    sim.bus.emit('chest', { x: 0, y: 0, coins: bn(1), sardines: 1 });
    expect(queued).not.toContain('chest');
  });

  it('у каждой подсказки есть текст', async () => {
    const { hasKey } = await import('../src/i18n');
    for (const id of HINT_IDS) expect(hasKey(`hint.${id}`), id).toBe(true);
  });
});

describe('мир в сохранении', () => {
  it('сессия ведёт путь по биому и смену биома', () => {
    const s = new GameSession(createGameState(0));
    const sim = new RunSim({ seed: 3 });
    s.attachRun(sim);
    sim.biomeProgressM = 777;
    s.tick(0.1);
    expect(s.state.world.progressM).toBe(777);
    sim.setBiome('forest');
    expect(s.state.world.biome).toBe('forest');
    expect(s.state.world.visited).toContain('forest');
  });

  it('Погружение возвращает на побережье, городок и дневник остаются', () => {
    const st = createGameState(0);
    st.coinsThisDive = bn(4e6);
    st.world = {
      biome: 'sunken',
      progressM: 900,
      lap: 2,
      bosses: { reefKeeper: 3 },
      visited: ['coast', 'forest', 'sunken'],
    };
    st.town = { lighthouse: 2 };
    st.journal = { fishman: 5 };
    const s = new GameSession(st);
    expect(s.dive(progressionConfig.order[0]!)).toBe(true);
    expect(s.state.world.biome).toBe('coast');
    expect(s.state.world.progressM).toBe(0);
    expect(s.state.world.lap).toBe(0);
    expect(s.state.world.bosses).toEqual({ reefKeeper: 3 });
    expect(s.state.world.visited).toHaveLength(3);
    expect(s.state.town).toEqual({ lighthouse: 2 });
    expect(s.state.journal).toEqual({ fishman: 5 });
  });

  it('сохранение v2 (до M4) мигрирует: путь с побережья, общий пробег из лучшей дистанции', () => {
    const v2 = {
      v: 2,
      coins: '500',
      darkStars: 2,
      stats: { bestDistanceM: 3210, kills: 40 },
      cat: { unlocked: true, levels: {} },
    };
    const s = decodeSave(btoa(JSON.stringify(v2)), 0)!;
    expect(s.coins.toNumber()).toBe(500);
    expect(s.darkStars).toBe(2);
    expect(s.world.biome).toBe('coast');
    expect(s.world.visited).toEqual(['coast']);
    expect(s.stats.distanceM).toBe(3210);
    expect(s.stats.kills).toBe(40);
    expect(s.hints).toEqual([]);
    expect(s.newspaper).toEqual({ lastDay: 0, streak: 0 });
  });
});

describe('контент M4: инварианты конфигов', () => {
  it('3 биома, у каждого свой босс и твари', () => {
    expect(progressionConfig.order).toEqual(['coast', 'forest', 'sunken']);
    const all = new Set<string>();
    for (const id of progressionConfig.order) {
      const b = biomesConfig[id]!;
      expect(progressionConfig.bosses[b.boss], id).toBeDefined();
      for (const e of Object.keys(b.enemyWeights)) {
        expect(enemiesConfig[e], `${id}: ${e}`).toBeDefined();
        all.add(e);
      }
    }
    expect(all.size).toBe(12);
    for (const boss of Object.values(progressionConfig.bosses)) {
      for (const e of boss.summon) expect(enemiesConfig[e]).toBeDefined();
    }
  });

  it('дневник: все твари и боссы, и только они', () => {
    const expected = [
      ...Object.keys(enemiesConfig),
      ...Object.keys(progressionConfig.bosses),
    ].sort();
    expect([...journalConfig.creatures].sort()).toEqual(expected);
  });
});
