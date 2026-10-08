import Phaser from 'phaser';
import display from '../config/display.json';
import { juiceConfig } from '../config';
import { t } from '../i18n';
import { platform } from '../platform/current';
import { palette, toCss } from '../render/palette';
import { allPlaceholderArt, toDataUri } from '../render/placeholders';
import { registerTextureScale } from '../render/textures';

/** Растеризует программные SVG-плейсхолдеры в текстуры и показывает прогресс. */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    const cx = display.width / 2;
    const cy = display.height / 2;
    const barW = 420;
    this.add
      .text(cx, cy - 50, t('loading'), {
        fontFamily: 'Georgia, serif',
        fontSize: '28px',
        color: toCss(palette.parchment),
      })
      .setOrigin(0.5);
    this.add.rectangle(cx, cy, barW + 8, 22, palette.outline).setStrokeStyle(3, palette.parchment);
    const fill = this.add
      .rectangle(cx - barW / 2, cy, 1, 14, palette.lanternAmber)
      .setOrigin(0, 0.5);
    this.load.on('progress', (v: number) => fill.setSize(Math.max(1, barW * v), 14));

    for (const a of allPlaceholderArt()) {
      const scale = a.scale ?? juiceConfig.textureScale;
      registerTextureScale(a.key, scale);
      this.load.svg(a.key, toDataUri(a.svg), { scale });
    }
  }

  create(): void {
    platform().loadingFinished();
    this.scene.start('RunScene');
  }
}
