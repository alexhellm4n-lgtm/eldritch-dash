import Phaser from 'phaser';
import { app } from '../app';
import { debugEnabled } from '../debug/flags';
import display from '../config/display.json';
import { upgradesConfig } from '../config';
import { formatNumber } from '../core/BigNum';
import { formatDuration, t, tId } from '../i18n';
import { palette, toCss } from '../render/palette';
import { isRaster, unitImage, unitScale } from '../render/textures';
import { addPanel, addPlate, addStrip, Button, fitStrip } from '../render/ui/Button';
import skin from '../render/ui/skin.json';
import { MetaHud } from '../render/ui/MetaHud';
import type { AchievementDef } from '../systems/Achievements';
import type { GameSession } from '../systems/GameSession';
import type { HintId } from '../systems/Hints';
import type { Issue } from '../systems/Newspaper';
import type { OfflineReport } from '../systems/Offline';
import type { RunSim } from '../systems/RunSim';
import type { GrimoireScene } from './GrimoireScene';
import type { JournalScene } from './JournalScene';
import type { ShopOverlay } from './ShopOverlay';
import type { TownScene } from './TownScene';

/** Сколько парения нужно, чтобы считать подсказку освоенной, с. */
const GLIDE_LEARNED_SEC = 0.4;
const MARGIN = 24;

type Hint = 'jump' | 'purchase' | 'glide' | HintId | null;

/** Сколько показывать подсказку по механике и пауза до следующей, мс. */
const MECHANIC_HINT_MS = 6500;
const HINT_GAP_MS = 1200;
/** Всплывашки (достижения, записи дневника): показ и интервал между ними, мс. */
const TOAST_MS = 2600;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
/** Высота подсказки: под полосой пути до босса. */
const HINT_Y = 196;

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
  private metaHud!: MetaHud;
  /** Текущая подсказка по механике и время, до которого она видна. */
  private mechanic: HintId | null = null;
  private mechanicUntil = 0;
  private nextHintAt = 0;
  private toastQueue: string[] = [];
  private toastText!: Phaser.GameObjects.Text;
  /** Свиток под подсказкой и плашка под всплывашкой (если есть растровый UI). */
  private hintScroll: Phaser.GameObjects.NineSlice | null = null;
  private toastPlate: Phaser.GameObjects.NineSlice | null = null;
  private toastUntil = 0;
  private newsModal: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('UIScene');
  }

  init(data: { sim: RunSim }): void {
    this.sim = data.sim;
    this.session = app().session;
    this.shownMeters = this.shownStreak = -1;
    this.hint = null;
    this.offlineModal = null;
    this.newsModal = null;
    this.mechanic = null;
    this.toastQueue = [];
  }

  create(): void {
    const title = { fontFamily: 'Georgia, serif', stroke: toCss(palette.outline) };
    // Плашка под кошельком и доходом в секунду.
    addPlate(this, MARGIN - 14, MARGIN - 16, 300, 112);
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
    this.hintScroll = addStrip(this, skin.scroll, display.width / 2, HINT_Y, 600, 90);
    this.hintScroll?.setAlpha(0);
    this.hintText = this.add
      .text(display.width / 2, HINT_Y, '', {
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
    if (this.hintScroll) {
      // На свитке — тёмные чернила вместо светлого текста с обводкой.
      this.hintText.setColor(toCss(palette.ink)).setStroke(toCss(palette.ink), 0).setFontSize(22);
      this.hintText.setWordWrapWidth(640);
    }

    this.shopButton = new Button(
      this,
      display.width - MARGIN - 80,
      display.height - MARGIN - 32,
      160,
      60,
      t('hud.shop'),
      { fontSize: 24, icon: 'ui_pouch' },
    ).onClick(() => this.shop().toggle());

    this.toastPlate = addStrip(this, skin.toast, display.width / 2, display.height - 150, 400, 64);
    this.toastPlate?.setAlpha(0);
    this.toastText = this.add
      .text(display.width / 2, display.height - 150, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: toCss(palette.lanternAmber),
        stroke: toCss(palette.outline),
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.metaHud = new MetaHud(this, this.session, () => this.sim, {
      grimoire: () => this.openOnly('grimoire'),
      town: () => this.openOnly('town'),
      journal: () => this.openOnly('journal'),
    });

    for (const key of ['ShopOverlay', 'GrimoireScene', 'TownScene', 'JournalScene']) {
      this.scene.launch(key);
      this.scene.bringToTop(key);
    }
    if (debugEnabled()) {
      this.scene.launch('DebugScene');
      this.scene.bringToTop('DebugScene');
    }

    const unsubs = [
      this.sim.bus.on('coin', () => (this.coinPulse = 1)),
      this.sim.bus.on('kill', () => (this.coinPulse = 1)),
      this.session.bus.on('purchase', () => this.session.completeTutorial('purchase')),
      this.session.bus.on('offline', (r) => this.showOffline(r)),
      this.session.bus.on('achievement', (a) => this.toast(this.achievementName(a))),
      this.session.bus.on('journalNew', (id) =>
        this.toast(t('popup.journalNew', { name: tId(`creature.${id}`) })),
      ),
      this.session.bus.on('journalFull', (id) =>
        this.toast(t('popup.journalFull', { name: tId(`creature.${id}`) })),
      ),
      this.session.bus.on('catUnlocked', () => this.session.queueHint('cat')),
      this.session.bus.on('phase', (p) => {
        if (p.id !== 'quiet') this.session.queueHint('phase');
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => unsubs.forEach((off) => off()));

    if (this.session.pendingOffline) this.showOffline(this.session.pendingOffline);
    else this.checkNewspaper();
  }

  private town(): TownScene {
    return this.scene.get('TownScene') as TownScene;
  }

  private journal(): JournalScene {
    return this.scene.get('JournalScene') as JournalScene;
  }

  /** Открывает одно окно (гримуар, городок, дневник), остальные закрывает. */
  private openOnly(which: 'grimoire' | 'town' | 'journal'): void {
    const windows = { grimoire: this.grimoire(), town: this.town(), journal: this.journal() };
    for (const [key, w] of Object.entries(windows)) {
      if (key === which) w.toggle();
      else w.close();
    }
    this.shop().close();
  }

  private get anyWindowOpen(): boolean {
    return (
      this.shop().opened || this.grimoire().opened || this.town().opened || this.journal().opened
    );
  }

  private achievementName(a: AchievementDef): string {
    const name = t('ach.name', { name: tId(`ach.${a.stat}`), tier: ROMAN[a.tier - 1] ?? '' });
    return t('popup.achievement', { name });
  }

  private toast(message: string): void {
    this.toastQueue.push(message);
  }

  private updateToast(): void {
    const now = this.time.now;
    if (now >= this.toastUntil && this.toastQueue.length > 0) {
      this.toastText.setText(this.toastQueue.shift()!);
      this.toastUntil = now + TOAST_MS;
      if (this.toastPlate) {
        fitStrip(this.toastPlate, this.toastText.width + 220, 66, skin.toast);
      }
      this.toastText.setScale(0.6);
      this.tweens.add({ targets: this.toastText, scale: 1, duration: 260, ease: 'Back.Out' });
    }
    const left = this.toastUntil - now;
    this.toastText.setAlpha(left <= 0 ? 0 : Math.min(1, left / 400, (TOAST_MS - left) / 150));
    this.toastPlate?.setAlpha(this.toastText.alpha);
  }

  private shop(): ShopOverlay {
    return this.scene.get('ShopOverlay') as ShopOverlay;
  }

  private grimoire(): GrimoireScene {
    return this.scene.get('GrimoireScene') as GrimoireScene;
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

    this.metaHud.update(this.time.now);
    // При низком рассудке тексты HUD слегка «плывут» (SPEC §4.3).
    const k = state.settings.reduceDistortion ? 0 : sim.sanity.distortion;
    const wobble = k * 0.035 * Math.sin(this.time.now / 260);
    this.coinsText.setRotation(wobble);
    this.distanceText.setRotation(-wobble);
    this.comboText.setRotation(wobble * 0.7);

    this.updateHint(deltaMs);
    this.updateToast();
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
    let hint: Hint;
    if (!tut.jump) hint = 'jump';
    else if (!tut.purchase && this.session.state.coins.gte(firstItem.base)) hint = 'purchase';
    else if (!tut.glide) hint = 'glide';
    else hint = this.mechanicHint();

    if (hint !== this.hint) {
      this.hint = hint;
      if (hint) {
        this.hintText.setText(t(`hint.${hint}`));
        if (this.hintScroll) {
          fitStrip(
            this.hintScroll,
            this.hintText.width + 190,
            Math.max(84, this.hintText.height + 56),
            skin.scroll,
          );
        }
      }
    }
    const visible = hint !== null && !this.offlineModal && !this.newsModal && !this.anyWindowOpen;
    const target = visible ? 0.8 + 0.2 * Math.sin(this.time.now / 300) : 0;
    const a = this.hintText.alpha;
    this.hintText.setAlpha(a + (target - a) * Math.min(1, deltaMs / 150));
    // Свиток не мерцает вместе с текстом — только появляется и исчезает.
    this.hintScroll?.setAlpha(
      visible ? Math.min(1, this.hintText.alpha / 0.8) : this.hintText.alpha,
    );

    // Кнопка лавки «дышит», пока ждёт первую покупку.
    const pulse = hint === 'purchase' ? 1 + 0.06 * Math.sin(this.time.now / 140) : 1;
    this.shopButton.setScale(pulse);
  }

  /**
   * Подсказки по механикам: по одной из очереди сессии, с паузой между ними.
   * Пока открыто окно или модалка — очередь ждёт.
   */
  private mechanicHint(): HintId | null {
    const now = this.time.now;
    if (this.mechanic && now < this.mechanicUntil) return this.mechanic;
    if (this.mechanic) {
      this.mechanic = null;
      this.nextHintAt = now + HINT_GAP_MS;
    }
    if (now < this.nextHintAt || this.offlineModal || this.newsModal || this.anyWindowOpen) {
      return null;
    }
    const next = this.session.takeHint();
    if (next) {
      this.mechanic = next;
      this.mechanicUntil = now + MECHANIC_HINT_MS;
    }
    return next;
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

    const W = 640;
    const H = 370;
    const cx = display.width / 2;
    const cy = display.height / 2;
    const ink = toCss(palette.ink);
    const modal = this.add.container(0, 0).setDepth(100);
    const shade = this.add
      .rectangle(0, 0, display.width, display.height, palette.nightSky, 0.6)
      .setOrigin(0)
      .setInteractive();
    const g = addPanel(this, cx - W / 2, cy - H / 2, W, H);
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
    this.checkNewspaper();
  }

  /** Утренняя газета (SPEC §6): раз в сутки по времени платформы, после онбординга. */
  checkNewspaper(): void {
    if (!this.session.state.tutorial.purchase || this.newsModal) return;
    void app()
      .platform.getServerTime()
      .catch(() => Date.now())
      .then((now) => {
        if (!this.scene.isActive() || this.offlineModal || this.newsModal) return;
        const issue = this.session.checkNewspaper(now);
        if (issue) this.showNewspaper(issue);
      });
  }

  private showNewspaper(issue: Issue): void {
    const paper = isRaster('ui_newspaper');
    const W = paper ? 520 : 660;
    const H = paper ? 600 : 520;
    const cx = display.width / 2;
    const cy = display.height / 2;
    const top = cy - H / 2;
    const ink = toCss(palette.ink);
    const notation = this.session.state.settings.notation;
    const modal = this.add.container(0, 0).setDepth(100);
    const shade = this.add
      .rectangle(0, 0, display.width, display.height, palette.nightSky, 0.6)
      .setOrigin(0)
      .setInteractive();
    const panel = paper
      ? this.add.image(cx, cy, 'ui_newspaper').setDisplaySize(W, H)
      : addPanel(this, cx - W / 2, cy - H / 2, W, H);
    // На газетном листе — шапка сверху, статьи на чистом поле поверх колонок.
    const yTitle = paper ? top + 74 : cy - 196;
    const yIssue = paper ? top + 120 : cy - 158;
    const yHeads = paper ? top + 196 : cy - 104;
    const headStep = paper ? 62 : 54;
    const yReward = paper ? top + 390 : cy + 74;
    const yClaim = paper ? top + H - 66 : cy + 204;
    const sheet = paper
      ? this.add
          .rectangle(cx, top + 330, W - 110, 330, palette.parchmentLight, 0.92)
          .setStrokeStyle(2, palette.ink, 0.5)
      : null;
    const title = this.add
      .text(cx, yTitle, t('news.title'), {
        fontFamily: 'Georgia, serif',
        fontSize: paper ? '34px' : '40px',
        fontStyle: 'bold',
        color: ink,
      })
      .setOrigin(0.5);
    const issueLine = this.add
      .text(cx, yIssue, t('news.issue', { streak: issue.streak }), {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        fontStyle: 'italic',
        color: toCss(palette.inkSoft),
      })
      .setOrigin(0.5);
    const rule = this.add.rectangle(cx, yIssue + 20, W - 140, 3, palette.ink).setVisible(!paper);
    const heads = issue.headlines.map((n, i) =>
      this.add
        .text(cx, yHeads + i * headStep, tId(`news.h${n}`), {
          fontFamily: 'Georgia, serif',
          fontSize: i === 0 ? '22px' : '18px',
          fontStyle: i === 0 ? 'bold' : 'normal',
          color: ink,
          align: 'center',
          wordWrap: { width: W - 150 },
        })
        .setOrigin(0.5),
    );
    const rewardParts = [`+${formatNumber(issue.coins, notation)} ⛀`];
    if (issue.sardines > 0) rewardParts.push(`+${issue.sardines} 🐟`);
    if (issue.essence > 0) rewardParts.push(`+${issue.essence} ◆`);
    const rewardLabel = this.add
      .text(cx, yReward, t('news.reward'), {
        fontFamily: 'sans-serif',
        fontSize: '17px',
        color: toCss(palette.inkSoft),
      })
      .setOrigin(0.5);
    const reward = this.add
      .text(cx, yReward + 36, rewardParts.join('   '), {
        fontFamily: 'Georgia, serif',
        fontSize: '30px',
        fontStyle: 'bold',
        color: toCss(palette.lanternAmber),
        stroke: toCss(palette.outline),
        strokeThickness: 6,
      })
      .setOrigin(0.5);
    const hint = this.add
      .text(cx, yReward + 76, t('news.streakHint'), {
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: toCss(palette.inkSoft),
        align: 'center',
        wordWrap: { width: W - 150 },
      })
      .setOrigin(0.5);
    const claim = new Button(this, cx, yClaim, 240, 60, t('news.claim')).onClick(() => {
      this.session.claimNewspaper();
      this.coinPulse = 1;
      this.newsModal = null;
      this.tweens.add({
        targets: modal,
        alpha: 0,
        duration: 160,
        onComplete: () => modal.destroy(),
      });
    });
    modal.add([shade, panel]);
    if (sheet) modal.add(sheet);
    modal.add([title, issueLine, rule, ...heads, rewardLabel, reward, hint, claim]);
    modal.setAlpha(0);
    this.tweens.add({ targets: modal, alpha: 1, duration: 220 });
    this.newsModal = modal;
  }
}

function setText(obj: Phaser.GameObjects.Text, text: string): void {
  if (obj.text !== text) obj.setText(text);
}
