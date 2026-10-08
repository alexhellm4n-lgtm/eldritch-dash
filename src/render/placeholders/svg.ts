import { tones } from '../palette';

/** Одна текстура-плейсхолдер: размер в игровых единицах (1280×720) и SVG-разметка. */
export interface PlaceholderArt {
  key: string;
  w: number;
  h: number;
  svg: string;
  /** Масштаб растеризации вместо общего textureScale (фонам высокая чёткость не нужна). */
  scale?: number;
}

/** Обводка по стилю SPEC §8.1: 3–4 px при 1280×720. */
export const STROKE = 4;

export const stroke = (width = STROKE): string =>
  `stroke="${tones.outline}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"`;

export function art(
  key: string,
  w: number,
  h: number,
  body: string,
  scale?: number,
): PlaceholderArt {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
  return scale === undefined ? { key, w, h, svg } : { key, w, h, svg, scale };
}

/** Повторяет содержимое со сдвигом ±width, чтобы слой бесшовно тайлился по горизонтали. */
export function tileX(width: number, body: string): string {
  return `<g>${body}</g><g transform="translate(${-width} 0)">${body}</g><g transform="translate(${width} 0)">${body}</g>`;
}

/** Загрузчик Phaser декодирует data:-URI через atob, поэтому только base64. */
export function toDataUri(svg: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(svg)) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
