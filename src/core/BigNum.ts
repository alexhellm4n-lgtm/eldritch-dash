import Decimal, { type DecimalSource } from 'break_infinity.js';

export { Decimal };
export type { DecimalSource };

export const ZERO = new Decimal(0);

export function bn(v: DecimalSource): Decimal {
  return v instanceof Decimal ? v : new Decimal(v);
}

export type Notation = 'suffix' | 'scientific';

/** Короткие суффиксы до триллионов; дальше — двухбуквенные aa, ab, …, az, ba, … (SPEC §5.5). */
const SHORT_SUFFIXES = ['', 'K', 'M', 'B', 'T'];
const FULL_BELOW = 1e6;
const NARROW_NBSP = ' ';

function groupThousands(int: number): string {
  return int.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NARROW_NBSP);
}

function letterSuffix(group: number): string {
  // group: 5 → aa (1e15), 6 → ab, …
  const i = group - SHORT_SUFFIXES.length;
  const first = String.fromCharCode(97 + Math.floor(i / 26));
  const second = String.fromCharCode(97 + (i % 26));
  return first + second;
}

/** Мантисса с тремя значащими цифрами: 1.23, 12.3, 123. Отбрасываем (не округляем вверх). */
function threeDigits(m: number): string {
  const digits = m < 10 ? 2 : m < 100 ? 1 : 0;
  const f = 10 ** digits;
  return (Math.floor(m * f + 1e-9) / f).toFixed(digits);
}

/**
 * Форматирование чисел для игрока:
 * - до 1e6 — целое с разделителями «12 345» (дробные < 100 — с одним знаком: «0.5»);
 * - от 1e6 — суффиксы M B T, затем aa, ab, …;
 * - `scientific` — «1.23e15».
 */
export function formatNumber(value: DecimalSource, notation: Notation = 'suffix'): string {
  const v = bn(value);
  if (v.lt(0)) return `-${formatNumber(v.mul(-1), notation)}`;
  if (v.lt(FULL_BELOW)) {
    const n = v.toNumber();
    if (n < 100 && !Number.isInteger(n)) {
      const r = Math.floor(n * 10) / 10;
      return Number.isInteger(r) ? r.toString() : r.toFixed(1);
    }
    return groupThousands(Math.floor(n));
  }
  if (notation === 'scientific') {
    return `${threeDigits(v.mantissa)}e${v.exponent}`;
  }
  const group = Math.floor(v.exponent / 3);
  const mantissa = v.mantissa * 10 ** (v.exponent - group * 3);
  const suffix = group < SHORT_SUFFIXES.length ? SHORT_SUFFIXES[group]! : letterSuffix(group);
  return threeDigits(mantissa) + suffix;
}
