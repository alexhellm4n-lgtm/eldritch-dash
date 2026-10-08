import ru from './ru.json';
import en from './en.json';

export type Language = 'ru' | 'en';
export type I18nKey = keyof typeof ru;

const dictionaries: Record<Language, Partial<Record<I18nKey, string>>> = { ru, en };

let current: Language = 'ru';

export function setLanguage(lang: Language): void {
  current = lang;
}

export function getLanguage(): Language {
  return current;
}

/** Перевод по ключу; `{name}` в строке подменяется значениями из `params`. */
export function t(key: I18nKey, params?: Record<string, string | number>): string {
  const template = dictionaries[current][key] ?? dictionaries.ru[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
