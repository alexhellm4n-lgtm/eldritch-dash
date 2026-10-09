import { describe, expect, it } from 'vitest';
import {
  biomesConfig,
  catConfig,
  dreamConfig,
  economyConfig,
  enemiesConfig,
  grimoireConfig,
  runConfig,
  sanityConfig,
  starsConfig,
} from '../src/config';
import { bn } from '../src/core/BigNum';
import { createGameState, DEFAULT_CAT_SKIN } from '../src/core/GameState';
import { DreamSim } from '../src/systems/Dream';
import { GameSession } from '../src/systems/GameSession';
import { darkStarsFor, omenChoices } from '../src/systems/Prestige';
import { RunSim } from '../src/systems/RunSim';
import { coinMultFor, Sanity } from '../src/systems/Sanity';
import { Stars } from '../src/systems/Stars';

const DT = 1 / 60;

function autopilot(sim: RunSim): void {
  const hero = sim.hero;
  const front = hero.x + runConfig.hero.width / 2;
  let jump = false;
  for (const e of sim.entities) {
    const d = e.x - e.w / 2 - front;
    if (e.kind === 'obstacle' && !e.spent && d > 0 && d < 90) jump = true;
    if (e.kind === 'enemy' && enemiesConfig[e.type]?.behavior === 'flyer' && d > 0 && d < 160) {
      jump = true;
    }
    // За страницами книги — прыжком.
    if (e.kind === 'pickup' && e.type === 'page' && d > 0 && d < 110) jump = true;
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

describe('Рассудок', () => {
  it('множитель монет 1 + (100 − рассудок)/100, кап ×2', () => {
    expect(coinMultFor(100, sanityConfig)).toBe(1);
    expect(coinMultFor(70, sanityConfig)).toBeCloseTo(1.3);
    expect(coinMultFor(0, sanityConfig)).toBe(2);
  });

  it('искажения ниже 50, скрытые препятствия ниже 20', () => {
    const s = new Sanity(sanityConfig);
    expect(s.distorted).toBe(false);
    s.set(40);
    expect(s.distorted).toBe(true);
    expect(s.distortion).toBeCloseTo(0.2);
    expect(s.hidesObstacles).toBe(false);
    s.set(10);
    expect(s.hidesObstacles).toBe(true);
  });

  it('на нуле — Прозрение: оглушение, затем награда и рассудок 60', () => {
    const sim = new RunSim({ seed: 3 });
    let start = 0;
    let reward = bn(0);
    sim.bus.on('insightStart', () => start++);
    sim.bus.on('insight', (a) => (reward = a));
    sim.sanity.set(0.1);
    run(sim, 0.5);
    expect(start).toBe(1);
    expect(sim.hero.stunned).toBe(true);
    run(sim, sanityConfig.insight.stunSec);
    expect(reward.gt(0)).toBe(true);
    expect(sim.sanity.value).toBeGreaterThanOrEqual(sanityConfig.insight.restoreTo - 1);
  });

  it('фонари и чай восстанавливают рассудок', () => {
    const sim = new RunSim({ seed: 11 });
    sim.sanity.set(30);
    let picked = 0;
    sim.bus.on('pickup', (e) => {
      if (e.type !== 'page') picked++;
    });
    run(sim, 90, autopilot);
    expect(picked).toBeGreaterThan(0);
  });

  it('SPEC §17: низкий рассудок выгоднее на 30–50 %, но больше оглушений', () => {
    const play = (sanity: number) => {
      const noDrain = {
        ...sanityConfig,
        drainPerSec: 0,
        pickups: { lantern: 0, tea: 0 },
        illusionChance: 0,
        hiddenChance: 0,
      };
      // Мини-боссы сравнение не меряют: их редкая крупная награда зашумляет разницу.
      const biomes = Object.fromEntries(
        Object.entries(biomesConfig).map(([id, b]) => [
          id,
          { ...b, miniBoss: { ...b.miniBoss, chance: 0 } },
        ]),
      );
      const sim = new RunSim({ seed: 21, biomes, sanity: { ...noDrain, contactLoss: 0 } });
      sim.sanity.set(sanity);
      run(sim, 120, autopilot);
      return sim.earned.toNumber();
    };
    const low = play(30);
    const high = play(70);
    const gain = low / high - 1;
    expect(gain).toBeGreaterThan(0.25);
    expect(gain).toBeLessThan(0.6);
    // «Сложнее»: на низком рассудке появляются иллюзии и невидимые препятствия.
    const hard = new RunSim({ seed: 21 });
    hard.sanity.set(10);
    let illusions = 0;
    let hidden = 0;
    hard.bus.on('spawn', (e) => {
      if (e.illusion) illusions++;
      if (e.hidden) hidden++;
    });
    run(hard, 60, (s) => {
      s.sanity.set(10);
      autopilot(s);
    });
    expect(illusions).toBeGreaterThan(0);
    expect(hidden).toBeGreaterThan(0);
  });
});

describe('Иллюзии', () => {
  it('безвредны: касание не оглушает, удар не даёт награды', () => {
    const sim = new RunSim({
      seed: 8,
      sanity: { ...sanityConfig, illusionChance: 1, drainPerSec: 0 },
    });
    sim.sanity.set(0.01);
    sim.sanity.set(1);
    let vanish = 0;
    let kills = 0;
    sim.bus.on('vanish', () => vanish++);
    sim.bus.on('kill', () => kills++);
    run(sim, 60, (s) => {
      s.sanity.set(1);
    });
    expect(vanish).toBeGreaterThan(0);
    expect(kills).toBe(0);
    expect(sim.essenceEarned).toBe(0);
  });
});

describe('Пробуждение', () => {
  it('шкала от убийств, 10 с: монеты ×3, твари на экране гибнут, рассудок −15', () => {
    const sim = new RunSim({ seed: 4 });
    run(sim, 20, autopilot);
    sim.awakenMeter = 1;
    sim.sanity.set(80);
    expect(sim.activateAwakening()).toBe(true);
    expect(sim.sanity.value).toBeCloseTo(80 - runConfig.awakening.sanityCost);
    expect(sim.coinMult).toBeCloseTo(sim.sanity.coinMult * runConfig.awakening.coinMult);
    let kills = 0;
    let aliveOnScreen = 0;
    sim.bus.on('kill', () => kills++);
    // Проверяем после каждого шага: на экране перед героем не остаётся живых настоящих тварей.
    for (let t = 0; t < runConfig.awakening.durationSec - 0.5; t += DT) {
      autopilot(sim);
      sim.update(DT);
      const ahead = sim.hero.x + runConfig.awakening.screenAheadPx;
      for (const e of sim.entities) {
        if (e.kind === 'enemy' && !e.illusion && e.hp > 0 && e.x < ahead) aliveOnScreen++;
      }
    }
    expect(kills).toBeGreaterThan(0);
    expect(aliveOnScreen).toBe(0);
    run(sim, 1);
    expect(sim.awakening).toBe(false);
    expect(sim.activateAwakening()).toBe(false);
  });

  it('шкала заполняется убийствами', () => {
    const sim = new RunSim({ seed: 42 });
    let ready = 0;
    sim.bus.on('awakenReady', () => ready++);
    run(sim, 240, autopilot);
    expect(ready).toBeGreaterThan(0);
  });
});

describe('Положение звёзд', () => {
  const stars = new Stars(starsConfig);

  it('детерминировано временем, меняется каждые 180 с, прогноз = следующий слот', () => {
    const t = 1_700_000_000_000;
    expect(stars.at(t).id).toBe(
      stars.at(t + 1000).id === stars.at(t).id ? stars.at(t).id : stars.at(t).id,
    );
    const info = stars.at(t);
    const nextStart = t + info.secondsLeft * 1000 + 1;
    expect(stars.at(nextStart).id).toBe(stars.next(t));
    expect(info.secondsLeft).toBeLessThanOrEqual(starsConfig.periodSec);
  });

  it('частоты фаз соответствуют весам, «звёзды сошлись» — редкие', () => {
    const counts: Record<string, number> = {};
    for (let slot = 0; slot < 20000; slot++) {
      const id = stars.phaseForSlot(slot);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    expect(counts.quiet!).toBeGreaterThan(counts.aligned!);
    expect(counts.aligned! / 20000).toBeLessThan(0.1);
    expect(Object.keys(counts).sort()).toEqual(Object.keys(starsConfig.phases).sort());
  });

  it('средний множитель за долгий офлайн между 1 и максимумом', () => {
    const avg = stars.averageCoinMult(0, 24 * 3600 * 1000);
    expect(avg).toBeGreaterThan(1);
    expect(avg).toBeLessThan(1.5);
    expect(stars.averageCoinMult(5000, 5000)).toBe(1);
  });

  it('фаза меняет забег: шторм замедляет, туман удлиняет парение', () => {
    const sim = new RunSim({ seed: 1 });
    const base = sim.hero.targetSpeed;
    const stamina = sim.hero.staminaMax;
    sim.setPhase(starsConfig.phases.storm!);
    expect(sim.hero.targetSpeed).toBeCloseTo(base * 0.85);
    sim.setPhase(starsConfig.phases.fog!);
    expect(sim.hero.targetSpeed).toBeCloseTo(base);
    expect(sim.hero.staminaMax).toBeCloseTo(stamina * 2);
  });
});

describe('Сновидение', () => {
  it('3 страницы → dreamReady', () => {
    const sim = new RunSim({ seed: 2, dream: { ...dreamConfig, pageChance: 0.5 } });
    let ready = 0;
    sim.bus.on('dreamReady', () => ready++);
    run(sim, 90, autopilot);
    expect(ready).toBeGreaterThan(0);
  });

  it('30 с полёта: кольца, монеты, ритм; награда растёт с очками', () => {
    const dream = new DreamSim(dreamConfig, 7);
    // «Игрок»: держится у ближайшего кольца/монеты и тапает в зелёной зоне.
    while (!dream.finished) {
      const target = dream.objects.find((o) => !o.taken && o.kind !== 'island' && o.x > dream.x);
      const wantUp = target ? dream.y > target.y + 10 : dream.y > 360;
      if (wantUp && dream.vy > -100) dream.tap();
      dream.update(DT);
    }
    expect(dream.time).toBeGreaterThanOrEqual(dreamConfig.durationSec);
    expect(dream.rings).toBeGreaterThan(3);
    expect(dream.coins).toBeGreaterThan(5);
    const session = new GameSession(createGameState(0));
    session.state.items.fisher = 10;
    const s2 = new GameSession(session.state);
    const r = s2.dreamReward(dream.points, dream.rings);
    expect(r.coins.gt(s2.dreamReward(1, 0).coins)).toBe(true);
    expect(r.sardines).toBeGreaterThanOrEqual(dreamConfig.reward.minSardines);
  });

  it('первый сон открывает кота', () => {
    const s = new GameSession(createGameState(0));
    const sim = new RunSim({ seed: 1 });
    s.attachRun(sim);
    expect(sim.catEnabled).toBe(false);
    s.claimDream(s.dreamReward(10, 3));
    expect(s.state.cat.unlocked).toBe(true);
    expect(sim.catEnabled).toBe(true);
    expect(s.state.stats.dreams).toBe(1);
  });
});

describe('Кот-фамильяр', () => {
  it('ловит летающих тварей и приносит монеты; шипит на иллюзии', () => {
    const sim = new RunSim({ seed: 42 });
    sim.catEnabled = true;
    let caught = 0;
    let fetched = 0;
    sim.bus.on('catCatch', () => caught++);
    sim.bus.on('catFetch', () => fetched++);
    run(sim, 180, autopilot);
    expect(caught + fetched).toBeGreaterThan(5);
  });
});

describe('Гримуар', () => {
  it('около 40 узлов в трёх главах, требования ссылаются на существующие узлы', () => {
    const ids = new Set(grimoireConfig.nodes.map((n) => n.id));
    expect(grimoireConfig.nodes.length).toBeGreaterThanOrEqual(38);
    for (const n of grimoireConfig.nodes) {
      expect(grimoireConfig.chapters).toContain(n.chapter);
      for (const r of n.requires) expect(ids, `${n.id} → ${r}`).toContain(r);
    }
    expect(grimoireConfig.nodes.some((n) => (n.darkStars ?? 0) > 0)).toBe(true);
  });

  it('покупка за Эссенцию, требования и тёмные звёзды', () => {
    const s = new GameSession(createGameState(0));
    s.state.essence = 1e6;
    expect(s.buyNode('h_essence1')).toBe(false); // нужен h_flash1
    expect(s.buyNode('h_flash1')).toBe(true);
    expect(s.buyNode('h_essence1')).toBe(true);
    expect(s.modifiers.essenceMult).toBeCloseTo(1.15);
    expect(s.modifiers.attackRangeMult).toBeCloseTo(1.1);
    const starNode = grimoireConfig.nodes.find((n) => (n.darkStars ?? 0) > 0)!;
    s.state.grimoire.push(...starNode.requires);
    expect(s.buyNode(starNode.id)).toBe(false);
    s.state.darkStars = starNode.darkStars!;
    expect(s.buyNode(starNode.id)).toBe(true);
  });
});

describe('Погружение', () => {
  it('тёмные звёзды = floor(sqrt(дублоны / 1e6))', () => {
    const p = economyConfig.prestige;
    expect(darkStarsFor(bn(999_999), p)).toBe(0);
    expect(darkStarsFor(bn(1e6), p)).toBe(1);
    expect(darkStarsFor(bn(4e6), p)).toBe(2);
    expect(darkStarsFor(bn(1.1e7), p)).toBe(3);
    expect(darkStarsFor(bn('1e106'), p)).toBe(1e50);
  });

  it('три разных знамения, выбор стабилен для глубины', () => {
    const a = omenChoices(2, economyConfig.prestige).map((o) => o.id);
    expect(new Set(a).size).toBe(3);
    expect(omenChoices(2, economyConfig.prestige).map((o) => o.id)).toEqual(a);
  });

  it('SPEC §16 M3: полный цикл до первого Погружения и обратно', () => {
    const s = new GameSession(createGameState(0));
    expect(s.canDive).toBe(false);
    // Первое погружение: копим дублоны забегом и покупками.
    s.earn(bn(4.2e6));
    s.buyItem('fisher', 10);
    s.buyHero('doubleJump');
    s.state.essence = 100;
    s.buyNode('h_flash1');
    s.state.cat.unlocked = true;
    s.state.sardines = 7;
    const essenceBefore = s.state.essence;
    expect(essenceBefore).toBeGreaterThan(0);
    expect(s.darkStarsAvailable).toBe(2);
    const cpsBefore = s.cps.toNumber();
    const omen = s.omenChoices()[0]!;
    expect(s.dive(omen.id)).toBe(true);
    // Сброшено.
    expect(s.state.coins.toNumber()).toBe(economyConfig.startCoins);
    expect(s.state.items).toEqual({});
    expect(s.state.heroUpgrades).toEqual({});
    expect(s.state.essence).toBe(0);
    expect(s.state.grimoire).toEqual([]); // h_flash1 не «keep»
    // Сохранено и выросло.
    expect(s.state.darkStars).toBe(2);
    expect(s.state.depth).toBe(2);
    expect(s.state.omen).toBe(omen.id);
    expect(s.state.cat.unlocked).toBe(true);
    expect(s.state.sardines).toBe(7);
    expect(s.starMult).toBeCloseTo(1.2);
    expect(cpsBefore).toBeGreaterThan(0);
    // И обратно: на новой глубине снова играем, копим, ныряем ещё.
    const sim = new RunSim({ seed: 5 });
    s.attachRun(sim);
    for (let t = 0; t < 30; t += DT) {
      autopilot(sim);
      sim.update(DT);
      s.tick(DT);
    }
    expect(s.state.coinsThisDive.gt(0)).toBe(true);
    s.earn(bn(9e6));
    expect(s.dive(s.omenChoices()[1]!.id)).toBe(true);
    expect(s.state.depth).toBe(3);
    expect(s.state.darkStars).toBeGreaterThan(2);
  });
});

describe('скины кота', () => {
  it('покупка за сардинки надевает скин; бесплатный — всегда свой', () => {
    const s = new GameSession(createGameState(0));
    const worn: string[] = [];
    s.bus.on('catSkin', (id) => worn.push(id));
    s.state.sardines = 1000;
    // До первого Сновидения кота нет — и шкурок тоже.
    expect(s.buyCatSkin('lighthouse')).toBe(false);
    s.state.cat.unlocked = true;
    expect(s.ownsCatSkin(DEFAULT_CAT_SKIN)).toBe(true);
    expect(s.ownsCatSkin('lighthouse')).toBe(false);
    expect(s.wearCatSkin('lighthouse')).toBe(false);

    const cost = catConfig.skins.find((k) => k.id === 'lighthouse')!.cost;
    expect(s.buyCatSkin('lighthouse')).toBe(true);
    expect(s.state.sardines).toBe(1000 - cost);
    expect(s.catSkin).toBe('lighthouse');
    expect(s.buyCatSkin('lighthouse')).toBe(false); // уже куплен

    expect(s.wearCatSkin(DEFAULT_CAT_SKIN)).toBe(true);
    expect(s.wearCatSkin(DEFAULT_CAT_SKIN)).toBe(false); // уже надет
    expect(worn).toEqual(['lighthouse', DEFAULT_CAT_SKIN]);
  });

  it('не хватает сардинок или неизвестный скин — покупки нет', () => {
    const s = new GameSession(createGameState(0));
    s.state.cat.unlocked = true;
    s.state.sardines = 1;
    expect(s.buyCatSkin('drowned')).toBe(false);
    expect(s.buyCatSkin('nope')).toBe(false);
    expect(s.state.sardines).toBe(1);
    // Битое сохранение: надет не купленный скин — показываем скин по умолчанию.
    s.state.cat.skin = 'drowned';
    expect(s.catSkin).toBe(DEFAULT_CAT_SKIN);
  });
});
