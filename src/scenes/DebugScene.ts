import Phaser from 'phaser';
import { app } from '../app';
import display from '../config/display.json';
import { economyConfig, starsConfig } from '../config';
import { bn } from '../core/BigNum';
import { t, tId } from '../i18n';
import { palette, toCss } from '../render/palette';
import { addPanel, Button } from '../render/ui/Button';
import type { RunScene } from './RunScene';

const W = 480;
const H = 650;
const X0 = display.width - W - 20;
const Y0 = 50;
const PAD = 48;
const COLS = 3;
const BTN_W = (W - PAD * 2 - (COLS - 1) * 8) / COLS;
const BTN_H = 34;
const ROW = BTN_H + 5;
const SECTION = 24;
const TWO_HOURS_MS = 2 * 3600 * 1000;
const SPEEDS = [1, 3, 8];

interface Action {
  label: () => string;
  run: () => void;
}

/**
 * Админ-панель (только dev или `?debug=1`): деньги, рассудок, Пробуждение, страницы и сон,
 * кот, фазы звёзд, офлайн, скорость, сброс прогресса.
 */
export class DebugScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private buttons: { b: Button; a: Action }[] = [];
  private resetArmed = false;

  constructor() {
    super('DebugScene');
  }

  private get run(): RunScene {
    return this.scene.get('RunScene') as RunScene;
  }

  create(): void {
    this.buttons = [];
    this.resetArmed = false;
    const session = app().session;

    this.root = this.add.container(0, 0).setVisible(false).setDepth(200);
    const panel = addPanel(this, X0, Y0, W, H);
    const blocker = this.add.zone(X0, Y0, W, H).setOrigin(0).setInteractive();
    this.root.add([panel, blocker]);
    this.root.add(
      this.add
        .text(X0 + PAD, Y0 + 44, t('debug.title'), {
          fontFamily: 'Georgia, serif',
          fontSize: '24px',
          fontStyle: 'bold',
          color: toCss(palette.ink),
        })
        .setOrigin(0, 0.5),
    );

    const sim = () => this.run.sim;
    const sections: [string, Action[]][] = [
      [
        'debug.sec.money',
        [
          { label: () => t('debug.coins1m'), run: () => session.earn(bn(1e6)) },
          {
            label: () => t('debug.coinsx10'),
            run: () => session.earn(session.state.coins.mul(9).add(1000)),
          },
          {
            label: () => t('debug.diveReady'),
            run: () => session.earn(bn(economyConfig.prestige.divisor * 4)),
          },
          { label: () => t('debug.essence'), run: () => (session.state.essence += 1000) },
          { label: () => t('debug.sardines'), run: () => (session.state.sardines += 50) },
          {
            label: () => t('debug.star'),
            run: () => {
              session.state.darkStars += 1;
              session.refreshBonuses();
            },
          },
        ],
      ],
      [
        'debug.sec.sanity',
        [100, 50, 25, 10, 0].map((v) => ({
          label: () => t('debug.sanity', { v }),
          // Ноль — чуть выше нуля: «Прозрение» запускается на следующем шаге, как в игре.
          run: () => sim().sanity.set(v === 0 ? 0.01 : v),
        })),
      ],
      [
        'debug.sec.mech',
        [
          {
            label: () => t('debug.awaken'),
            run: () => {
              sim().awakenMeter = 1;
              sim().bus.emit('awakenReady', undefined);
            },
          },
          { label: () => t('debug.page'), run: () => sim().grantPage() },
          { label: () => t('debug.dream'), run: () => this.run.startDream() },
          {
            label: () => t('debug.cat', { state: session.state.cat.unlocked ? '✓' : '✕' }),
            run: () => {
              session.state.cat.unlocked = !session.state.cat.unlocked;
              session.refreshBonuses();
              this.run.catView.setVisible(session.state.cat.unlocked);
            },
          },
        ],
      ],
      [
        'debug.sec.phase',
        [
          ...Object.keys(starsConfig.phases).map((id) => ({
            label: () => (session.forcedPhase === id ? '▶ ' : '') + tId(`phase.${id}`),
            run: () => {
              session.forcedPhase = id;
              session.updatePhase(Date.now());
            },
          })),
          {
            label: () => (session.forcedPhase === null ? '▶ ' : '') + t('debug.phaseAuto'),
            run: () => {
              session.forcedPhase = null;
              session.updatePhase(Date.now());
            },
          },
        ],
      ],
      [
        'debug.sec.misc',
        [
          {
            label: () => t('debug.offline'),
            run: () => {
              session.state.lastSeen -= TWO_HOURS_MS;
              session.checkOffline(Date.now());
            },
          },
          {
            label: () => t('debug.speed', { v: this.run.debugTimeScale }),
            run: () => {
              const i = SPEEDS.indexOf(this.run.debugTimeScale);
              this.run.debugTimeScale = SPEEDS[(i + 1) % SPEEDS.length]!;
            },
          },
          {
            label: () =>
              t('debug.distortion', { state: session.state.settings.reduceDistortion ? '✓' : '✕' }),
            run: () =>
              (session.state.settings.reduceDistortion = !session.state.settings.reduceDistortion),
          },
          {
            label: () => (this.resetArmed ? t('debug.resetConfirm') : t('debug.reset')),
            run: () => this.reset(),
          },
        ],
      ],
    ];

    let y = Y0 + 84;
    for (const [title, actions] of sections) {
      this.root.add(
        this.add
          .text(X0 + PAD, y, t(title as 'debug.sec.money'), {
            fontFamily: 'sans-serif',
            fontSize: '14px',
            fontStyle: 'bold',
            color: toCss(palette.inkSoft),
          })
          .setOrigin(0, 0.5),
      );
      y += SECTION - 4;
      actions.forEach((a, i) => {
        const col = i % COLS;
        const row = Math.floor(i / COLS);
        const b = new Button(
          this,
          X0 + PAD + BTN_W / 2 + col * (BTN_W + 8),
          y + BTN_H / 2 + row * ROW,
          BTN_W,
          BTN_H,
          a.label(),
          { fontSize: 13, fill: palette.parchmentLight, plain: true, radius: 8 },
        ).onClick(() => {
          a.run();
          this.refreshLabels();
        });
        this.root.add(b);
        this.buttons.push({ b, a });
      });
      y += Math.ceil(actions.length / COLS) * ROW + 6;
    }

    // Шестерёнка — переключатель панели (под счётчиком страниц справа).
    new Button(this, display.width - 44, 146, 44, 44, '⚙', {
      fill: palette.parchmentShade,
      fontSize: 24,
      radius: 22,
      plain: true,
    })
      .setDepth(201)
      .onClick(() => this.toggle());
  }

  private toggle(): void {
    this.root.setVisible(!this.root.visible);
    this.resetArmed = false;
    this.refreshLabels();
  }

  private refreshLabels(): void {
    for (const { b, a } of this.buttons) b.setLabel(a.label());
  }

  /** Сброс прогресса: первое нажатие взводит, второе — стирает сохранение и перезагружает страницу. */
  private reset(): void {
    if (!this.resetArmed) {
      this.resetArmed = true;
      return;
    }
    const { saves, platform } = app();
    // Сначала отключаем автосейв, иначе pagehide сохранит текущий прогресс обратно.
    saves.stop();
    void platform.saveCloud('').then(() => window.location.reload());
  }
}
