import Phaser from 'phaser';
import display from './config/display.json';
import { setLanguage } from './i18n';
import { palette } from './render/palette';
import type { PlatformAdapter } from './platform/PlatformAdapter';
import { setPlatform } from './platform/current';
import { WebAdapter } from './platform/WebAdapter';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { RunScene } from './scenes/RunScene';
import { UIScene } from './scenes/UIScene';

// TODO(M5): выбор адаптера по флагу сборки (build:web | build:crazy | build:yandex).
function createAdapter(): PlatformAdapter {
  return new WebAdapter();
}

async function bootstrap(): Promise<void> {
  const adapter = createAdapter();
  await adapter.init();
  setPlatform(adapter);
  setLanguage(adapter.getLanguage());

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: display.parentId,
    width: display.width,
    height: display.height,
    backgroundColor: palette.nightSky,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, PreloadScene, RunScene, UIScene],
  });
  // Для отладки из консоли браузера; в production-сборку не попадает.
  if (import.meta.env.DEV) Object.assign(window, { game });
}

void bootstrap();
