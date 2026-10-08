import backgrounds from './backgrounds.json';
import enemyParts from './enemyParts.json';
import heroParts from './heroParts.json';
import catParts from './catParts.json';
import fxParts from './fxParts.json';
import propParts from './propParts.json';
import uiParts from './uiParts.json';

/** Растровый ассет, собранный скриптами из `scripts/` (пути относительно `public/`). */
export interface RasterAsset {
  file: string;
  /** Во сколько раз текстура крупнее игровых единиц. */
  scale: number;
}

/** Растровый слой фона: лежит полосой на своей высоте кадра. */
export interface BackgroundAsset {
  file: string;
  /** Верхний край слоя в кадре 1280×720. */
  y: number;
  width: number;
  height: number;
}

/** Ключ текстуры → слой фона (scripts/build-bg.ts). Заменяет SVG-плейсхолдер с тем же ключом. */
export const backgroundAssets: Readonly<Record<string, BackgroundAsset>> = backgrounds;

/** Ключ текстуры → часть героя (scripts/build-hero.ts). */
export const heroPartAssets: Readonly<Record<string, RasterAsset>> = heroParts;

/** Ключ текстуры → часть твари (scripts/build-parts.ts). */
export const enemyPartAssets: Readonly<Record<string, RasterAsset>> = enemyParts;

/**
 * Группы ассетов, которые используются только вместе (части одного рига).
 * Если не загрузился хотя бы один файл группы, вся группа откатывается на плейсхолдеры.
 */
export function rasterGroups(): string[][] {
  const groups: string[][] = Object.keys(backgroundAssets).map((k) => [k]);
  groups.push(Object.keys(heroPartAssets));
  const byCreature = new Map<string, string[]>();
  for (const key of Object.keys(enemyPartAssets)) {
    const creature = key.split('_')[0]!;
    byCreature.set(creature, [...(byCreature.get(creature) ?? []), key]);
  }
  groups.push(...byCreature.values());
  // Предметы независимы: каждый откатывается сам по себе.
  groups.push(...Object.keys(propPartAssets).map((k) => [k]));
  groups.push(...Object.keys(fxPartAssets).map((k) => [k]));
  groups.push(...Object.keys(uiPartAssets).map((k) => [k]));
  groups.push(Object.keys(catPartAssets));
  return groups.filter((g) => g.length > 0);
}

/** Ключ текстуры → предмет трассы: препятствия, монета (scripts/build-parts.ts). */
export const propPartAssets: Readonly<Record<string, RasterAsset>> = propParts;

/** Частицы и световые эффекты; элементы интерфейса (scripts/build-parts.ts). */
export const fxPartAssets: Readonly<Record<string, RasterAsset>> = fxParts;
export const uiPartAssets: Readonly<Record<string, RasterAsset>> = uiParts;
/** Кот-фамильяр: части одного рига, откатываются вместе. */
export const catPartAssets: Readonly<Record<string, RasterAsset>> = catParts;

/** Все растровые замены плейсхолдеров. */
export function rasterOverrides(): Record<string, RasterAsset> {
  const out: Record<string, RasterAsset> = {};
  for (const [key, a] of Object.entries(backgroundAssets)) out[key] = { file: a.file, scale: 1 };
  for (const [key, a] of Object.entries(heroPartAssets)) out[key] = a;
  for (const [key, a] of Object.entries(enemyPartAssets)) out[key] = a;
  for (const [key, a] of Object.entries(propPartAssets)) out[key] = a;
  for (const [key, a] of Object.entries(fxPartAssets)) out[key] = a;
  for (const [key, a] of Object.entries(uiPartAssets)) out[key] = a;
  for (const [key, a] of Object.entries(catPartAssets)) out[key] = a;
  return out;
}
