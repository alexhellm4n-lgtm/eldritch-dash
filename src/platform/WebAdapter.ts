import type { Language } from '../i18n';
import type { PlatformAdapter } from './PlatformAdapter';

const SAVE_KEY = 'eldritch-dash.save';

/** Адаптер для Web / itch.io / GitHub Pages: без SDK, сохранения в localStorage. */
export class WebAdapter implements PlatformAdapter {
  async init(): Promise<void> {}

  getLanguage(): Language {
    return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
  }

  // TODO(M5): фейковое окно «тут была бы реклама» перед выдачей награды.
  async showRewarded(): Promise<boolean> {
    return true;
  }

  async loadCloudSave(): Promise<string | null> {
    try {
      return localStorage.getItem(SAVE_KEY);
    } catch {
      return null;
    }
  }

  async saveCloud(data: string): Promise<void> {
    try {
      localStorage.setItem(SAVE_KEY, data);
    } catch {
      // localStorage недоступен (приватный режим, iframe) — молча продолжаем.
    }
  }

  gameplayStart(): void {}
  gameplayStop(): void {}
  loadingFinished(): void {}

  async getServerTime(): Promise<number> {
    return Date.now();
  }
}
