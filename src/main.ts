import Phaser from 'phaser';
import { setApp } from './app';
import display from './config/display.json';
import { economyConfig } from './config';
import { createGameState } from './core/GameState';
import { setLanguage } from './i18n';
import type { PlatformAdapter } from './platform/PlatformAdapter';
import { WebAdapter } from './platform/WebAdapter';
import { palette } from './render/palette';
import { SaveManager } from './save/SaveManager';
import { BootScene } from './scenes/BootScene';
import { DebugScene } from './scenes/DebugScene';
import { DreamScene } from './scenes/DreamScene';
import { GrimoireScene } from './scenes/GrimoireScene';
import { JournalScene } from './scenes/JournalScene';
import { TownScene } from './scenes/TownScene';
import { PreloadScene } from './scenes/PreloadScene';
import { RunScene } from './scenes/RunScene';
import { ShopOverlay } from './scenes/ShopOverlay';
import { UIScene } from './scenes/UIScene';
import { GameSession } from './systems/GameSession';

// TODO(M5): выбор адаптера по флагу сборки (build:web | build:crazy | build:yandex).
function createAdapter(): PlatformAdapter {
  return new WebAdapter();
}

async function bootstrap(): Promise<void> {
  const platform = createAdapter();
  await platform.init();
  setLanguage(platform.getLanguage());

  let session: GameSession | null = null;
  const saves = new SaveManager(platform, () => session!.state);
  const loaded = await saves.load();
  const now = Date.now();
  session = new GameSession(loaded ?? createGameState(now, economyConfig.startCoins));
  if (loaded) session.checkOffline(now);
  saves.start(economyConfig.autosaveSec, (t) => session.checkOffline(t));
  setApp({ platform, session, saves });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: display.parentId,
    width: display.width,
    height: display.height,
    backgroundColor: palette.nightSky,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [
      BootScene,
      PreloadScene,
      RunScene,
      UIScene,
      ShopOverlay,
      GrimoireScene,
      TownScene,
      JournalScene,
      DreamScene,
      DebugScene,
    ],
  });
  // Для отладки из консоли браузера; в production-сборку не попадает.
  if (import.meta.env.DEV) Object.assign(window, { game, session, saves });
}

void bootstrap();
