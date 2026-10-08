import type { GameState } from '../core/GameState';
import { migrate } from './migrations';
import { fromSaveData, toSaveData } from './schema';

/** Хранилище сохранений — PlatformAdapter (облако/localStorage) удовлетворяет этому контракту. */
export interface SaveStorage {
  loadCloudSave(): Promise<string | null>;
  saveCloud(data: string): Promise<void>;
}

function toBase64(text: string): string {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** GameState → строка для хранения/экспорта: JSON → base64 (SPEC §13; сжатие — позже). */
export function encodeSave(state: GameState): string {
  return toBase64(JSON.stringify(toSaveData(state)));
}

/** Строка → GameState. null, если строка не является сохранением (битая, чужая, из будущей версии). */
export function decodeSave(data: string, now: number): GameState | null {
  try {
    const raw: unknown = JSON.parse(fromBase64(data.trim()));
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    return fromSaveData(migrate(raw as Record<string, unknown>), now);
  } catch {
    return null;
  }
}

/**
 * Автосейв каждые N секунд, при скрытии вкладки и при уходе со страницы.
 * При возвращении на вкладку сообщает о времени отсутствия (для офлайн-дохода).
 */
export class SaveManager {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly storage: SaveStorage,
    private readonly getState: () => GameState,
    private readonly now: () => number = Date.now,
  ) {}

  async load(): Promise<GameState | null> {
    const data = await this.storage.loadCloudSave();
    return data ? decodeSave(data, this.now()) : null;
  }

  save(): void {
    const state = this.getState();
    state.lastSeen = this.now();
    // WebAdapter пишет в localStorage синхронно внутри вызова — это важно для pagehide.
    void this.storage.saveCloud(encodeSave(state));
  }

  start(autosaveSec: number, onReturn: (nowMs: number) => void): void {
    this.stop();
    this.timer = setInterval(() => this.save(), autosaveSec * 1000);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
    this.onReturn = onReturn;
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
  }

  private onReturn: (nowMs: number) => void = () => {};

  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.save();
    else this.onReturn(this.now());
  };

  private readonly onPageHide = (): void => this.save();
}
