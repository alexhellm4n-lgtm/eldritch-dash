import Phaser from 'phaser';
import display from '../config/display.json';
import { formatInt } from '../core/format';
import { t } from '../i18n';
import { palette, toCss } from '../render/palette';
import { unitImage, unitScale } from '../render/textures';
import type { RunSim } from '../systems/RunSim';

/** Время, сколько парения нужно, чтобы считать подсказку освоенной, с. */
const GLIDE_LEARNED_SEC = 0.4;
const MARGIN = 24;

type HintStage = 'jump' | 'glide' | 'done';

/** HUD поверх забега. Только читает состояние RunSim. */
export class UIScene extends Phaser.Scene {
  private sim!: RunSim;
  private coinsText!: Phaser.GameObjects.Text;
  private coinIcon!: Phaser.GameObjects.Image;
  private comboText!: Phaser.GameObjects.Text;
  private distanceText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private shownCoins = -1;
  private shownMeters = -1;
  private shownStreak = -1;
  private hint: HintStage = 'jump';
  private coinPulse = 0;

  constructor() {
    super('UIScene');
  }

  init(data: { sim: RunSim }): void {
    this.sim = data.sim;
    this.shownCoins = this.shownMeters = this.shownStreak = -1;
    this.hint = 'jump';
  }

  create(): void {
    const title = { fontFamily: 'Georgia, serif', stroke: toCss(palette.outline) };
    this.coinIcon = unitImage(this, 'coin', MARGIN + 20, MARGIN + 22).setScale(
      unitScale('coin') * 1.3,
    );
    this.coinsText = this.add
      .text(MARGIN + 48, MARGIN + 22, '0', {
        ...title,
        fontSize: '38px',
        fontStyle: 'bold',
        color: toCss(palette.lanternAmber),
        strokeThickness: 7,
      })
      .setOrigin(0, 0.5);
    this.comboText = this.add
      .text(MARGIN, MARGIN + 62, '', {
        ...title,
        fontSize: '22px',
        color: toCss(palette.bioCyan),
        strokeThickness: 5,
      })
      .setOrigin(0, 0.5);
    this.distanceText = this.add
      .text(display.width - MARGIN, MARGIN + 22, '', {
        ...title,
        fontSize: '28px',
        color: toCss(palette.parchment),
        strokeThickness: 6,
      })
      .setOrigin(1, 0.5);
    this.hintText = this.add
      .text(display.width / 2, 150, t('hint.jump'), {
        fontFamily: 'sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: toCss(palette.parchment),
        stroke: toCss(palette.outline),
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5);

    this.sim.bus.on('coin', () => (this.coinPulse = 1));
    this.sim.bus.on('kill', () => (this.coinPulse = 1));
  }

  override update(_time: number, deltaMs: number): void {
    const sim = this.sim;

    const coins = Math.floor(sim.coins);
    if (coins !== this.shownCoins) {
      this.shownCoins = coins;
      this.coinsText.setText(formatInt(coins));
    }
    this.coinPulse = Math.max(0, this.coinPulse - deltaMs / 180);
    this.coinIcon.setScale(unitScale('coin') * (1.3 + 0.25 * this.coinPulse));

    const meters = Math.floor(sim.meters);
    if (meters !== this.shownMeters) {
      this.shownMeters = meters;
      this.distanceText.setText(t('hud.distance', { value: formatInt(meters) }));
    }

    const streak = sim.combo.streak;
    if (streak !== this.shownStreak) {
      this.shownStreak = streak;
      this.comboText.setText(
        streak > 0 ? t('hud.combo', { streak, mult: sim.combo.multiplier.toFixed(2) }) : '',
      );
    }

    this.updateHint(deltaMs);
  }

  /** Онбординг без текстовой стены: прыжок → парение, потом подсказка исчезает. */
  private updateHint(deltaMs: number): void {
    const stats = this.sim.stats;
    if (this.hint === 'jump' && stats.jumps > 0) {
      this.hint = 'glide';
      this.hintText.setText(t('hint.glide'));
    } else if (this.hint === 'glide' && stats.glideSec >= GLIDE_LEARNED_SEC) {
      this.hint = 'done';
    }
    const target = this.hint === 'done' ? 0 : 0.75 + 0.25 * Math.sin(this.time.now / 300);
    const a = this.hintText.alpha;
    this.hintText.setAlpha(a + (target - a) * Math.min(1, deltaMs / 150));
  }
}
