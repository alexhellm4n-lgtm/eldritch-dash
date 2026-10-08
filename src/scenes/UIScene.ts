import Phaser from 'phaser';
import { app } from '../app';
import display from '../config/display.json';
import { upgradesConfig } from '../config';
import { formatNumber } from '../core/BigNum';
import { formatDuration, t } from '../i18n';
import { palette, toCss } from '../render/palette';
import { unitImage, unitScale } from '../render/textures';
import { Button, drawPanel } from '../render/ui/Button';
import type { GameSession } from '../systems/GameSession';
import type { OfflineReport } from '../systems/Offline';
import type { RunSim } from '../systems/RunSim';
import type { ShopOverlay } from './ShopOverlay';

/** Сколько парения нужно, чтобы считать подсказку освоенной, с. */
const GLIDE_LEARNED_SEC = 0.4;
const MARGIN = 24;

type Hint = 'jump' | 'purchase' | 'glide' | null;

/** HUD поверх забега. Только читает состояние и шлёт команды сессии. */
export class UIScene extends Phaser.Scene {
  private sim!: RunSim;
  private session!: GameSession;
  private coinsText!: Phaser.GameObjects.Text;
  private cpsText!: Phaser.GameObjects.Text;
  private coinIcon!: Phaser.GameObjects.Image;
  private comboText!: Phaser.GameObjects.Text;
  private distanceText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private shopButton!: Button;
  private offlineModal: Phaser.GameObjects.Container | null = null;
  private offlineAmount: Phaser.GameObjects.Text | null = null;
  private offlineAway: Phaser.GameObjects.Text | null = null;
  private shownMeters = -1;
  private shownStreak = -1;
  private hint: Hint = null;
  private coinPulse = 0;

  constructor() {
    super('UIScene');
  }

  init(data: { sim: RunSim }): void {
    this.sim = data.sim;
    this.session = app().session;
    this.shownMeters = this.shownStreak = -1;
    this.hint = null;
    this.offlineModal = null;
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
    this.cpsText = this.add
      .text(MARGIN + 50, MARGIN + 58, '', {
        ...title,
        fontSize: '20px',
        color: toCss(palette.parchment),
        strokeThickness: 5,
      })
      .setOrigin(0, 0.5);
    this.comboText = this.add
      .text(MARGIN, MARGIN + 90, '', {
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
      .text(display.width / 2, 150, '', {
        fontFamily: 'sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: toCss(palette.parchment),
        stroke: toCss(palette.outline),
        strokeThickness: 6,
        align: 'center',
        wordWrap: { width: 760 },
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.shopButton = new Button(
      this,
      display.width - MARGIN - 80,
      display.height - MARGIN - 32,
      160,
      60,
      t('hud.shop'),
      { fontSize: 24 },
    ).onClick(() => this.shop().toggle());

    this.scene.launch('ShopOverlay');
    this.scene.bringToTop('ShopOverlay');

    const unsubs = [
      this.sim.bus.on('coin', () => (this.coinPulse = 1)),
      this.sim.bus.on('kill', () => (this.coinPulse = 1)),
      this.session.bus.on('purchase', () => this.session.completeTutorial('purchase')),
      this.session.bus.on('offline', (r) => this.showOffline(r)),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => unsubs.forEach((off) => off()));

    if (this.session.pendingOffline) this.showOffline(this.session.pendingOffline);
  }

  private shop(): ShopOverlay {
    return this.scene.get('ShopOverlay') as ShopOverlay;
  }

  override update(_time: number, deltaMs: number): void {
    const sim = this.sim;
    const state = this.session.state;
    const notation = state.settings.notation;

    setText(this.coinsText, formatNumber(state.coins.floor(), notation));
    const cps = this.session.cps;
    setText(this.cpsText, cps.gt(0) ? t('hud.cps', { value: formatNumber(cps, notation) }) : '');
    this.coinPulse = Math.max(0, this.coinPulse - deltaMs / 180);
    this.coinIcon.setScale(unitScale('coin') * (1.3 + 0.25 * this.coinPulse));

    const meters = Math.floor(sim.meters);
    if (meters !== this.shownMeters) {
      this.shownMeters = meters;
      this.distanceText.setText(t('hud.distance', { value: formatNumber(meters) }));
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

  /**
   * Онбординг без текстовой стены (SPEC §10): прыжок → первая покупка → парение.
   * Пройденные шаги хранятся в сохранении и больше не показываются.
   */
  private updateHint(deltaMs: number): void {
    const tut = this.session.state.tutorial;
    const stats = this.sim.stats;
    if (!tut.jump && stats.jumps > 0) this.session.completeTutorial('jump');
    if (!tut.glide && stats.glideSec >= GLIDE_LEARNED_SEC) this.session.completeTutorial('glide');

    const firstItem = upgradesConfig.items[0]!;
    let hint: Hint = null;
    if (!tut.jump) hint = 'jump';
    else if (!tut.purchase && this.session.state.coins.gte(firstItem.base)) hint = 'purchase';
    else if (!tut.glide) hint = 'glide';

    if (hint !== this.hint) {
      this.hint = hint;
      if (hint) this.hintText.setText(t(`hint.${hint}`));
    }
    const visible = hint !== null && !this.offlineModal && !this.shop().opened;
    const target = visible ? 0.8 + 0.2 * Math.sin(this.time.now / 300) : 0;
    const a = this.hintText.alpha;
    this.hintText.setAlpha(a + (target - a) * Math.min(1, deltaMs / 150));

    // Кнопка лавки «дышит», пока ждёт первую покупку.
    const pulse = hint === 'purchase' ? 1 + 0.06 * Math.sin(this.time.now / 140) : 1;
    this.shopButton.setScale(pulse);
  }

  private showOffline(report: OfflineReport): void {
    const notation = this.session.state.settings.notation;
    const amountText = `+${formatNumber(report.amount, notation)}`;
    const capped = report.awaySeconds > report.seconds + 1;
    const awayText =
      t('offline.away', { time: formatDuration(report.awaySeconds) }) +
      (capped ? ` (${t('offline.capped', { time: formatDuration(report.seconds) })})` : '');
    if (this.offlineModal) {
      this.offlineAmount?.setText(amountText);
      this.offlineAway?.setText(awayText);
      return;
    }

    const W = 600;
    const H = 330;
    const cx = display.width / 2;
    const cy = display.height / 2;
    const ink = toCss(palette.ink);
    const modal = this.add.container(0, 0).setDepth(100);
    const shade = this.add
      .rectangle(0, 0, display.width, display.height, palette.nightSky, 0.6)
      .setOrigin(0)
      .setInteractive();
    const g = this.add.graphics();
    drawPanel(g, cx - W / 2, cy - H / 2, W, H);
    const heading = this.add
      .text(cx, cy - 118, t('offline.title'), {
        fontFamily: 'Georgia, serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: ink,
      })
      .setOrigin(0.5);
    const away = this.add
      .text(cx, cy - 72, awayText, {
        fontFamily: 'sans-serif',
        fontSize: '18px',
        color: toCss(palette.inkSoft),
      })
      .setOrigin(0.5);
    const earned = this.add
      .text(cx, cy - 36, t('offline.earned'), {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: ink,
      })
      .setOrigin(0.5);
    const amount = this.add
      .text(cx, cy + 14, amountText, {
        fontFamily: 'Georgia, serif',
        fontSize: '46px',
        fontStyle: 'bold',
        color: toCss(palette.lanternAmber),
        stroke: toCss(palette.outline),
        strokeThickness: 7,
      })
      .setOrigin(0.5);

    const claim = new Button(this, cx - 140, cy + 100, 230, 60, t('offline.claim'), {
      fill: palette.parchmentShade,
    });
    const double = new Button(this, cx + 140, cy + 100, 230, 60, t('offline.double'));
    claim.onClick(() => this.closeOffline(1));
    double.onClick(() => {
      claim.setEnabled(false);
      double.setEnabled(false);
      void app()
        .platform.showRewarded('offline_x2')
        .catch(() => false)
        .then((rewarded) => {
          claim.setEnabled(true);
          double.setEnabled(true);
          // Отказ или ошибка рекламы — окно остаётся, можно забрать ×1.
          if (rewarded) this.closeOffline(2);
        });
    });

    modal.add([shade, g, heading, away, earned, amount, claim, double]);
    modal.setAlpha(0);
    this.tweens.add({ targets: modal, alpha: 1, duration: 200 });
    this.offlineModal = modal;
    this.offlineAmount = amount;
    this.offlineAway = away;
  }

  private closeOffline(mult: number): void {
    this.session.claimOffline(mult);
    this.coinPulse = 1;
    const modal = this.offlineModal;
    this.offlineModal = this.offlineAmount = this.offlineAway = null;
    if (!modal) return;
    this.tweens.add({
      targets: modal,
      alpha: 0,
      duration: 160,
      onComplete: () => modal.destroy(),
    });
  }
}

function setText(obj: Phaser.GameObjects.Text, text: string): void {
  if (obj.text !== text) obj.setText(text);
}
