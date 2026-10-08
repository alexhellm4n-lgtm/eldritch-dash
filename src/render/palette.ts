/** Цветовые токены стиля (SPEC §8.1). */
export const palette = {
  outline: 0x1a1426,
  deepTeal: 0x0f3b45,
  seaGreen: 0x2e7d6b,
  bioCyan: 0x5cf2d6,
  sicklyViolet: 0x6b3fa0,
  lanternAmber: 0xffb547,
  parchment: 0xead9b0,
  fog: 0x9fb3b8,
  nightSky: 0x0b0f1f,
} as const;

export type PaletteToken = keyof typeof palette;

/** 0xRRGGBB → '#rrggbb' для текстовых стилей Phaser. */
export function toCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
