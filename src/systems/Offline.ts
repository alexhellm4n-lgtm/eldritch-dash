import type { EconomyConfig } from '../config/types';
import type { Decimal } from '../core/BigNum';
import { offlineSeconds } from '../core/Clock';

export interface OfflineReport {
  /** Засчитанное время (уже ограниченное cap), с. */
  seconds: number;
  /** Реальное отсутствие, с (для текста «пока тебя не было…»). */
  awaySeconds: number;
  amount: Decimal;
}

/**
 * Офлайн-доход (SPEC §5.2): CpS × min(время, cap) × rate. Слишком короткое отсутствие
 * (меньше minSec) не даёт отчёта — чтобы не показывать окно при каждом переключении вкладки.
 */
export function computeOffline(
  cps: Decimal,
  lastSeenMs: number,
  nowMs: number,
  cfg: EconomyConfig['offline'],
  capSec = cfg.capSec,
): OfflineReport | null {
  const away = Math.max(0, (nowMs - lastSeenMs) / 1000);
  const seconds = offlineSeconds(lastSeenMs, nowMs, capSec);
  if (seconds < cfg.minSec || cps.lte(0)) return null;
  return { seconds, awaySeconds: away, amount: cps.mul(seconds * cfg.rate) };
}
