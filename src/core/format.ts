/**
 * Временное форматирование до появления BigNum (M2): целое с пробелами-разделителями тысяч.
 * Используется неразрывный узкий пробел, чтобы число не переносилось.
 */
export function formatInt(n: number): string {
  const v = Math.floor(Math.max(0, n));
  return v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Дробные награды (множитель комбо) показываем с одним знаком, целые — без. */
export function formatReward(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? formatInt(rounded) : rounded.toFixed(1);
}
