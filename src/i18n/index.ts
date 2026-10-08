import ru from './ru.json';
import en from './en.json';

export type Language = 'ru' | 'en';
export type I18nKey = keyof typeof ru;
type Params = Record<string, string | number>;

const dictionaries: Record<Language, Partial<Record<string, string>>> = { ru, en };

let current: Language = 'ru';

export function setLanguage(lang: Language): void {
  current = lang;
}

export function getLanguage(): Language {
  return current;
}

function lookup(key: string, params?: Params): string {
  const template = dictionaries[current][key] ?? dictionaries.ru[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Перевод по ключу; `{name}` в строке подменяется значениями из `params`. */
export function t(key: I18nKey, params?: Params): string {
  return lookup(key, params);
}

/** Перевод по ключу, собранному из данных (`item.${id}`). Отсутствие ключа ловит tests/i18n.test.ts. */
export function tId(key: string, params?: Params): string {
  return lookup(key, params);
}

export function hasKey(key: string): boolean {
  return key in dictionaries.ru;
}

/** Длительность для игрока: «2 ч 13 мин», «4 мин 5 с», «40 с». */
export function formatDuration(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return t('time.hm', { h, m });
  if (m > 0) return t('time.ms', { m, s });
  return t('time.s', { s });
}
