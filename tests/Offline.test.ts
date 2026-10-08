import { describe, expect, it } from 'vitest';
import { economyConfig } from '../src/config';
import { bn } from '../src/core/BigNum';
import { offlineSeconds } from '../src/core/Clock';
import { computeOffline } from '../src/systems/Offline';

const off = economyConfig.offline;
const HOUR = 3600 * 1000;

describe('offline', () => {
  it('формула: CpS × время × 0.5', () => {
    const r = computeOffline(bn(10), 0, HOUR, off)!;
    expect(r.seconds).toBe(3600);
    expect(r.amount.toNumber()).toBeCloseTo(10 * 3600 * off.rate);
  });

  it('ограничено капом 4 часа', () => {
    expect(off.capSec).toBe(4 * 3600);
    const r = computeOffline(bn(10), 0, 30 * HOUR, off)!;
    expect(r.seconds).toBe(off.capSec);
    expect(r.awaySeconds).toBe(30 * 3600);
    expect(r.amount.toNumber()).toBeCloseTo(10 * off.capSec * off.rate);
  });

  it('кап можно расширить (гримуар)', () => {
    const r = computeOffline(bn(1), 0, 30 * HOUR, off, 24 * 3600)!;
    expect(r.seconds).toBe(24 * 3600);
  });

  it('перевод часов назад не даёт отрицательного дохода', () => {
    expect(offlineSeconds(HOUR, 0, off.capSec)).toBe(0);
    expect(computeOffline(bn(10), HOUR, 0, off)).toBeNull();
  });

  it('короткое отсутствие и нулевой CpS — без отчёта', () => {
    expect(computeOffline(bn(10), 0, (off.minSec - 1) * 1000, off)).toBeNull();
    expect(computeOffline(bn(0), 0, HOUR, off)).toBeNull();
  });

  it('мусор во времени не ломает расчёт', () => {
    expect(offlineSeconds(NaN, 1000, off.capSec)).toBe(0);
  });
});
