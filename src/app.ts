import type { PlatformAdapter } from './platform/PlatformAdapter';
import type { SaveManager } from './save/SaveManager';
import type { GameSession } from './systems/GameSession';

/** Сервисы приложения, общие для всех сцен. Собираются в main.ts до старта Phaser. */
export interface App {
  platform: PlatformAdapter;
  session: GameSession;
  saves: SaveManager;
}

let current: App | null = null;

export function setApp(services: App): void {
  current = services;
}

export function app(): App {
  if (!current) throw new Error('App не инициализирован');
  return current;
}
