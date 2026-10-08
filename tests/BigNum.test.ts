import { describe, expect, it } from 'vitest';
import { bn, formatNumber } from '../src/core/BigNum';

const S = ' ';

describe('formatNumber', () => {
  it('до 1e6 — целые с разделителями тысяч', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(12345)).toBe(`12${S}345`);
    expect(formatNumber(999999.9)).toBe(`999${S}999`);
  });

  it('маленькие дробные — с одним знаком без лишнего нуля', () => {
    expect(formatNumber(0.5)).toBe('0.5');
    expect(formatNumber(1.25)).toBe('1.2');
    expect(formatNumber(2.04)).toBe('2');
    expect(formatNumber(150.7)).toBe('150');
  });

  it('суффиксы M B T и три значащие цифры', () => {
    expect(formatNumber(1e6)).toBe('1.00M');
    expect(formatNumber(1234567)).toBe('1.23M');
    expect(formatNumber(12345678)).toBe('12.3M');
    expect(formatNumber(123456789)).toBe('123M');
    expect(formatNumber(4.5e9)).toBe('4.50B');
    expect(formatNumber(7.89e12)).toBe('7.89T');
  });

  it('после T — двухбуквенные aa, ab, …, az, ba', () => {
    expect(formatNumber(1e15)).toBe('1.00aa');
    expect(formatNumber(2.5e18)).toBe('2.50ab');
    expect(formatNumber(bn('1e90'))).toBe('1.00az');
    expect(formatNumber(bn('1e93'))).toBe('1.00ba');
    // 1e498 = группа 166 → индекс 161 → 'g' (6) + 'f' (5).
    expect(formatNumber(bn('3.21e498'))).toBe('3.21gf');
    expect(formatNumber(bn('3.21e500'))).toBe('321gf');
  });

  it('научная запись', () => {
    expect(formatNumber(1234567, 'scientific')).toBe('1.23e6');
    expect(formatNumber(bn('9.876e1234'), 'scientific')).toBe('9.87e1234');
    expect(formatNumber(1234, 'scientific')).toBe(`1${S}234`);
  });

  it('не округляет вверх (не показывает больше, чем есть)', () => {
    expect(formatNumber(1999999)).toBe('1.99M');
  });
});
