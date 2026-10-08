import { afterEach, describe, expect, it } from 'vitest';
import ru from '../src/i18n/ru.json';
import en from '../src/i18n/en.json';
import { setLanguage, t } from '../src/i18n';

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

  it('переключает язык', () => {
    expect(t('game.subtitle')).toBe(ru['game.subtitle']);
    setLanguage('en');
    expect(t('game.subtitle')).toBe(en['game.subtitle']);
  });
});
