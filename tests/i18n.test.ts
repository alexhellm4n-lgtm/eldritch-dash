import { afterEach, describe, expect, it } from 'vitest';
import ru from '../src/i18n/ru.json';
import en from '../src/i18n/en.json';
import { upgradesConfig } from '../src/config';
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
