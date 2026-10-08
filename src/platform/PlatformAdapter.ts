import type { Language } from '../i18n';

/** Контракт платформенного адаптера (SPEC §3). */
export interface PlatformAdapter {
  init(): Promise<void>;
  getLanguage(): Language;
  /** true = награда положена. */
  showRewarded(placement: string): Promise<boolean>;
  /** По умолчанию выключено (ads.json). */
  showInterstitial?(): Promise<void>;
  loadCloudSave(): Promise<string | null>;
  saveCloud(data: string): Promise<void>;
  gameplayStart(): void;
  gameplayStop(): void;
  loadingFinished(): void;
  /** Для дейликов. */
  getServerTime(): Promise<number>;
}
