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
  // Производные тона для тонировки частей.
  coral: 0xe07a8f,
  rope: 0xc9a66b,
  /** Притемнение дальних частей (задняя нога, крыло). */
  farShade: 0xa8a0b8,
  /** Задетый объект. */
  spentShade: 0xb0a8c0,
  /** Пробитая броня. */
  crackedShade: 0xb89a8a,
  /** Притемнение ближнего декора фона (читаемость геймплея). */
  nearDecorShade: 0x9890ac,
  /** Лёгкие оттенки для сгенерированного дыма. */
  puffTintCool: 0xc8f4ff,
  puffTintWarm: 0xffd2dc,
  /** Неактивная табличка-кнопка (умножается на латунь). */
  plaqueInactive: 0xb8a890,
  /** Светло-фиолетовый текст HUD (Эссенция, глубина). */
  violetLightUi: 0xc8a8f0,
  /** Тёмно-фиолетовая подложка шкал. */
  violetShadeUi: 0x3a2456,
  /** Цвет виньетки искажений. */
  violetDeep: 0x2a1240,
  // UI
  parchmentShade: 0xcdb884,
  parchmentLight: 0xf5ead0,
  ink: 0x2b2238,
  inkSoft: 0x5a4b6b,
} as const;

/**
 * Производные тона для плейсхолдеров: заливка + один тон тени (SPEC §8.1).
 * Строки — для SVG.
 */
export const tones = {
  outline: '#1A1426',
  nightSky: '#0B0F1F',
  deepTeal: '#0F3B45',
  deepTealDark: '#0A2A33',
  seaGreen: '#2E7D6B',
  seaGreenShade: '#215C50',
  bioCyan: '#5CF2D6',
  violet: '#6B3FA0',
  violetShade: '#4E2C78',
  violetLight: '#8D62C4',
  amber: '#FFB547',
  amberShade: '#E08A1E',
  amberLight: '#FFE2A3',
  parchment: '#EAD9B0',
  parchmentShade: '#CDB884',
  fog: '#9FB3B8',
  fogShade: '#7A9096',
  skin: '#F2D3B3',
  skinShade: '#D9AE8A',
  coat: '#2F4A5C',
  coatShade: '#22374A',
  wood: '#8A5A3B',
  woodShade: '#6A4229',
  rope: '#C9A66B',
  ropeShade: '#9E7F4A',
  coral: '#E07A8F',
  coralShade: '#B85A70',
  gull: '#EEF2F2',
  gullShade: '#C3CCCF',
  fish: '#5FA59A',
  fishShade: '#3F7F75',
  white: '#FFFFFF',
} as const;

export type PaletteToken = keyof typeof palette;

/** 0xRRGGBB → '#rrggbb' для текстовых стилей Phaser. */
export function toCss(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
