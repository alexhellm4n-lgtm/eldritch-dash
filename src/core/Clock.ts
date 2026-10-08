/**
 * Офлайн-дельта с защитой от «перевода часов» (SPEC §13): не отрицательная и не больше cap.
 * Возвращает секунды.
 */
export function offlineSeconds(lastSeenMs: number, nowMs: number, capSec: number): number {
  const sec = (nowMs - lastSeenMs) / 1000;
  if (!Number.isFinite(sec) || sec <= 0) return 0;
  return Math.min(sec, capSec);
}
