/**
 * Админ-панель для проверки механик: в dev-сборке всегда, в production — по адресу `?debug=1`.
 * TODO(M5): вырезать из сборок для порталов (CrazyGames, Яндекс Игры).
 */
export function debugEnabled(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return new URLSearchParams(window.location.search).has('debug');
  } catch {
    return false;
  }
}
