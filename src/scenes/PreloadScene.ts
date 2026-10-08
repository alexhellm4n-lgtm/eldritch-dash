import Phaser from 'phaser';
import display from '../config/display.json';
import { juiceConfig } from '../config';
import { t } from '../i18n';
import { app } from '../app';
import { palette, toCss } from '../render/palette';
import { rasterGroups, rasterOverrides } from '../render/rasterAssets';
import { allPlaceholderArt, toDataUri, type PlaceholderArt } from '../render/placeholders';
import { markRasterLoaded, registerTextureScale } from '../render/textures';

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

    // Готовые растровые ассеты (фоны, части героя) заменяют плейсхолдеры с теми же ключами.
    const raster = rasterOverrides();
    for (const [key, asset] of Object.entries(raster)) {
      registerTextureScale(key, asset.scale);
      this.load.image(key, asset.file);
    }
    for (const a of allPlaceholderArt()) {
      if (!(a.key in raster)) this.loadPlaceholder(a);
    }
  }

  private loadPlaceholder(a: PlaceholderArt): void {
    const scale = a.scale ?? juiceConfig.textureScale;
    registerTextureScale(a.key, scale);
    this.load.svg(a.key, toDataUri(a.svg), { scale });
  }

  create(): void {
    // Растровые ассеты могли не загрузиться (сеть, офлайн): такие группы откатываем на плейсхолдеры,
    // не смешивая растровые и векторные части одного рига.
    const placeholders = new Map(allPlaceholderArt().map((a) => [a.key, a]));
    let fallback = false;
    for (const group of rasterGroups()) {
      if (group.every((key) => this.textures.exists(key))) {
        group.forEach(markRasterLoaded);
        continue;
      }
      for (const key of group) {
        if (this.textures.exists(key)) this.textures.remove(key);
        const art = placeholders.get(key);
        if (art) {
          this.loadPlaceholder(art);
          fallback = true;
        }
      }
    }
    if (!fallback) {
      this.startGame();
      return;
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.startGame());
    this.load.start();
  }

  private startGame(): void {
    app().platform.loadingFinished();
    this.scene.start('RunScene');
  }
}
