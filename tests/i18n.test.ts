import { afterEach, describe, expect, it } from 'vitest';
import ru from '../src/i18n/ru.json';
import en from '../src/i18n/en.json';
import {
  achievementsConfig,
  catConfig,
  economyConfig,
  grimoireConfig,
  journalConfig,
  newspaperConfig,
  progressionConfig,
  starsConfig,
  townConfig,
  upgradesConfig,
} from '../src/config';
import { formatDuration, hasKey, setLanguage, t } from '../src/i18n';

describe('i18n', () => {
  afterEach(() => setLanguage('ru'));

  it('RU и EN содержат одинаковый набор ключей', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ru).sort());
  });

  it('нет пустых строк', () => {
    for (const dict of [ru, en]) {
      for (const value of Object.values(dict)) expect(value.trim()).not.toBe('');
    }
  });

  it('у каждого снаряжения и улучшения есть название и описание', () => {
    for (const item of upgradesConfig.items) expect(hasKey(`item.${item.id}`), item.id).toBe(true);
    for (const u of upgradesConfig.hero) {
      expect(hasKey(`hero.${u.id}`), u.id).toBe(true);
      expect(hasKey(`hero.${u.id}.desc`), u.id).toBe(true);
    }
  });

  it('у мета-систем M3 есть тексты: фазы, знамения, кот, эффекты гримуара', () => {
    for (const id of Object.keys(starsConfig.phases)) {
      expect(hasKey(`phase.${id}`), id).toBe(true);
      expect(hasKey(`phase.${id}.desc`), id).toBe(true);
    }
    for (const o of economyConfig.prestige.omens) {
      expect(hasKey(`omen.${o.id}`), o.id).toBe(true);
      expect(hasKey(`omen.${o.id}.desc`), o.id).toBe(true);
    }
    for (const u of catConfig.upgrades) {
      expect(hasKey(`cat.${u.id}`), u.id).toBe(true);
      expect(hasKey(`cat.${u.id}.desc`), u.id).toBe(true);
    }
    for (const n of grimoireConfig.nodes) {
      for (const k of Object.keys(n.add ?? {}))
        expect(hasKey(`effect.add.${k}`), `${n.id}: ${k}`).toBe(true);
      for (const k of Object.keys(n.mul ?? {}))
        expect(hasKey(`effect.mul.${k}`), `${n.id}: ${k}`).toBe(true);
    }
  });

  it('у контента M4 есть тексты: твари, записи дневника, биомы, постройки, достижения, газета', () => {
    for (const id of journalConfig.creatures) {
      expect(hasKey(`creature.${id}`), id).toBe(true);
      expect(hasKey(`journal.${id}`), id).toBe(true);
    }
    for (const id of progressionConfig.order) expect(hasKey(`biome.${id}`), id).toBe(true);
    for (const b of townConfig.buildings) {
      expect(hasKey(`town.${b.id}`), b.id).toBe(true);
      expect(hasKey(`town.${b.id}.desc`), b.id).toBe(true);
      for (const k of Object.keys(b.add ?? {})) expect(hasKey(`effect.add.${k}`), k).toBe(true);
      for (const k of Object.keys(b.mul ?? {})) expect(hasKey(`effect.mul.${k}`), k).toBe(true);
    }
    for (const g of achievementsConfig.groups) {
      expect(hasKey(`ach.${g.stat}`), g.stat).toBe(true);
      expect(hasKey(`ach.${g.stat}.desc`), g.stat).toBe(true);
    }
    for (let i = 1; i <= newspaperConfig.headlines; i++)
      expect(hasKey(`news.h${i}`), `h${i}`).toBe(true);
    expect(hasKey(`news.h${newspaperConfig.headlines + 1}`)).toBe(false);
  });

  it('длительность', () => {
    expect(formatDuration(40)).toBe('40 с');
    expect(formatDuration(245)).toBe('4 мин 5 с');
    expect(formatDuration(2 * 3600 + 13 * 60 + 9)).toBe('2 ч 13 мин');
  });

  it('переключает язык', () => {
    expect(t('game.subtitle')).toBe(ru['game.subtitle']);
    setLanguage('en');
    expect(t('game.subtitle')).toBe(en['game.subtitle']);
  });
});
