import Phaser from 'phaser';
import display from './config/display.json';
import { setLanguage } from './i18n';
import { palette } from './render/palette';
import type { PlatformAdapter } from './platform/PlatformAdapter';
import { WebAdapter } from './platform/WebAdapter';
import { BootScene } from './scenes/BootScene';

// TODO(M5): выбор адаптера по флагу сборки (build:web | build:crazy | build:yandex).
function createAdapter(): PlatformAdapter {
  return new WebAdapter();
}

async function bootstrap(): Promise<void> {
  const platform = createAdapter();
  await platform.init();
  setLanguage(platform.getLanguage());

  new Phaser.Game({
    type: Phaser.AUTO,
    parent: display.parentId,
    width: display.width,
    height: display.height,
    backgroundColor: palette.nightSky,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene],
  });

  platform.loadingFinished();
}

void bootstrap();
