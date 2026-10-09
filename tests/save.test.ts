import { describe, expect, it } from 'vitest';
import { bn } from '../src/core/BigNum';
import { createGameState } from '../src/core/GameState';
import { migrate, SaveVersionError, type Migration } from '../src/save/migrations';
import { decodeSave, encodeSave } from '../src/save/SaveManager';
import { SAVE_VERSION } from '../src/save/schema';

function sample() {
  const s = createGameState(1_000);
  s.coins = bn('1.2345e300');
  s.coinsThisDive = bn(42.5);
  s.coinsLifetime = bn('9e305');
  s.items = { fisher: 12, bookbinder: 3 };
  s.heroUpgrades = { doubleJump: 1 };
  s.tutorial = { jump: true, glide: true, purchase: false };
  s.settings.notation = 'scientific';
  s.stats = {
    playtimeSec: 321.5,
    bestDistanceM: 1234,
    kills: 77,
    dreams: 2,
    awakenings: 5,
    insights: 1,
    dives: 1,
    distanceM: 5000,
    bossKills: 2,
    miniBossKills: 4,
    chests: 6,
    pages: 9,
    illusions: 3,
  };
  s.hints = ['stun', 'page'];
  s.world = {
    biome: 'forest',
    progressM: 1234.5,
    lap: 1,
    bosses: { reefKeeper: 2 },
    visited: ['coast', 'forest'],
  };
  s.town = { lighthouse: 3, chapel: 1 };
  s.journal = { fishman: 12, reefKeeper: 1 };
  s.achievements = ['kills_1', 'dives_1'];
  s.newspaper = { lastDay: 20000, streak: 4 };
  s.essence = 12.5;
  s.sardines = 9;
  s.darkStars = 3;
  s.depth = 2;
  s.omen = 'greed';
  s.grimoire = ['h_flash1', 'd_coin1'];
  s.cat = { unlocked: true, levels: { catSpeed: 2 } };
  s.settings.reduceDistortion = true;
  s.lastSeen = 5_000;
  return s;
}

describe('сохранения', () => {
  it('encode → decode без потерь (включая огромные числа)', () => {
    const s = sample();
    const back = decodeSave(encodeSave(s), 9_999)!;
    expect(back.coins.toString()).toBe(s.coins.toString());
    expect(back.coinsThisDive.toNumber()).toBe(42.5);
    expect(back.coinsLifetime.toString()).toBe(s.coinsLifetime.toString());
    expect(back.items).toEqual(s.items);
    expect(back.heroUpgrades).toEqual(s.heroUpgrades);
    expect(back.tutorial).toEqual(s.tutorial);
    expect(back.settings).toEqual(s.settings);
    expect(back.stats).toEqual(s.stats);
    expect(back.lastSeen).toBe(5_000);
    expect(back.createdAt).toBe(1_000);
    expect(back.essence).toBe(12.5);
    expect(back.sardines).toBe(9);
    expect(back.darkStars).toBe(3);
    expect(back.depth).toBe(2);
    expect(back.omen).toBe('greed');
    expect(back.grimoire).toEqual(['h_flash1', 'd_coin1']);
    expect(back.cat).toEqual({ unlocked: true, levels: { catSpeed: 2 } });
    expect(back.hints).toEqual(s.hints);
    expect(back.world).toEqual(s.world);
    expect(back.town).toEqual(s.town);
    expect(back.journal).toEqual(s.journal);
    expect(back.achievements).toEqual(s.achievements);
    expect(back.newspaper).toEqual(s.newspaper);
  });

  it('строка экспорта — base64 без пробелов, переживает пробелы по краям', () => {
    const str = encodeSave(sample());
    expect(str).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(decodeSave(`  ${str}\n`, 0)).not.toBeNull();
  });

  it('мусор → null, а не исключение', () => {
    expect(decodeSave('', 0)).toBeNull();
    expect(decodeSave('не base64 !!!', 0)).toBeNull();
    expect(decodeSave(btoa('[1,2,3]'), 0)).toBeNull();
    expect(decodeSave(btoa('{"v":999}'), 0)).toBeNull();
  });

  it('битые поля заменяются значениями по умолчанию', () => {
    const raw = {
      v: 1,
      coins: 'abc',
      items: { fisher: -3, bookbinder: 2.5, smuggler: 4 },
      stats: 'x',
    };
    const s = decodeSave(btoa(JSON.stringify(raw)), 123)!;
    expect(s.coins.toNumber()).toBe(0);
    expect(s.items).toEqual({ smuggler: 4 });
    expect(s.stats.playtimeSec).toBe(0);
    expect(s.lastSeen).toBe(123);
  });

  it('сохранение v1 (до M3) мигрирует: новые поля по умолчанию, прогресс цел', () => {
    const v1 = { v: 1, coins: '777', items: { fisher: 3 }, heroUpgrades: { doubleJump: 1 } };
    const s = decodeSave(btoa(JSON.stringify(v1)), 0)!;
    expect(s.coins.toNumber()).toBe(777);
    expect(s.items.fisher).toBe(3);
    expect(s.depth).toBe(1);
    expect(s.darkStars).toBe(0);
    expect(s.grimoire).toEqual([]);
    expect(s.cat.unlocked).toBe(false);
  });

  it('сохранение без версии (v0) мигрирует до текущей', () => {
    const s = decodeSave(btoa(JSON.stringify({ coins: '50', items: { fisher: 2 } })), 0)!;
    expect(s.coins.toNumber()).toBe(50);
    expect(s.items.fisher).toBe(2);
  });
});

describe('миграции', () => {
  const chain: Record<number, Migration> = {
    1: (d) => ({ ...d, v: 2, gold: d.coins }),
    2: (d) => ({ ...d, v: 3, renamed: true }),
  };

  it('применяются по цепочке до целевой версии', () => {
    const out = migrate({ v: 1, coins: '7' }, chain, 3);
    expect(out).toEqual({ v: 3, coins: '7', gold: '7', renamed: true });
  });

  it('текущая версия не трогается', () => {
    const d = { v: SAVE_VERSION, coins: '1' };
    expect(migrate(d)).toBe(d);
  });

  it('пропуск в цепочке и версия из будущего — ошибка', () => {
    expect(() => migrate({ v: 1 }, { 1: chain[1]! }, 3)).toThrow(SaveVersionError);
    expect(() => migrate({ v: 99 }, chain, 3)).toThrow(SaveVersionError);
    expect(() => migrate({ v: 1 }, { 1: (d) => ({ ...d, v: 5 }) }, 3)).toThrow(SaveVersionError);
  });
});
