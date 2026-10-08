import Phaser from 'phaser';
import display from '../config/display.json';
import { t } from '../i18n';
import { palette, toCss } from '../render/palette';

/** M0: пустая сцена-заглушка — проверяет, что сборка, i18n и палитра работают. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(palette.nightSky);
    const cx = display.width / 2;
    const cy = display.height / 2;

    this.add
      .text(cx, cy - 40, t('game.title'), {
        fontFamily: 'Georgia, serif',
        fontSize: '72px',
        color: toCss(palette.lanternAmber),
        stroke: toCss(palette.outline),
        strokeThickness: 8,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 30, t('game.subtitle'), {
        fontFamily: 'Georgia, serif',
        fontSize: '32px',
        color: toCss(palette.parchment),
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 100, t('boot.placeholder'), {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: toCss(palette.fog),
      })
      .setOrigin(0.5);
  }
}
