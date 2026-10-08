import type { PlatformAdapter } from './PlatformAdapter';

let current: PlatformAdapter | null = null;

export function setPlatform(adapter: PlatformAdapter): void {
  current = adapter;
}

/** Активный платформенный адаптер (выставляется в main.ts до старта игры). */
export function platform(): PlatformAdapter {
  if (!current) throw new Error('PlatformAdapter не инициализирован');
  return current;
}
