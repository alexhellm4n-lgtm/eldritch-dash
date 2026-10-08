import { describe, expect, it } from 'vitest';
import { palette, toCss } from '../src/render/palette';

describe('palette', () => {
  it('toCss форматирует с ведущими нулями', () => {
    expect(toCss(palette.nightSky)).toBe('#0b0f1f');
    expect(toCss(0x000001)).toBe('#000001');
  });
});
