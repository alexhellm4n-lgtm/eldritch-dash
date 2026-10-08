import type Phaser from 'phaser';
import display from '../../config/display.json';
import { dreamConfig, sanityConfig } from '../../config';
import { formatNumber } from '../../core/BigNum';
import { t, tId } from '../../i18n';
import type { GameSession } from '../../systems/GameSession';
import type { RunSim } from '../../systems/RunSim';
import { palette, toCss } from '../palette';
import { unitImage } from '../textures';
import { Button } from './Button';

const MARGIN = 24;
const SANITY_W = 220;
const SANITY_H = 14;
const ICON_H = 24;
const AWAKEN_W = 220;

function fit(img: Phaser.GameObjects.Image, height: number): Phaser.GameObjects.Image {
  return img.setScale(height / (img.height || 1));
}

function setText(obj: Phaser.GameObjects.Text, text: string): void {
  if (obj.text !== text) obj.setText(text);
}

/**
 * HUD мета-систем M3 (SPEC §10): фаза звёзд с прогнозом, Эссенция/сардинки/тёмные звёзды,
 * шкала рассудка, глубина, страницы книги, шкала и кнопка Пробуждения, кнопка гримуара.
 */
export class MetaHud {
  private readonly phaseIcon: Phaser.GameObjects.Image;
  private readonly phaseName: Phaser.GameObjects.Text;
  private readonly phaseLeft: Phaser.GameObjects.Text;
  private readonly phaseNextIcon: Phaser.GameObjects.Image;
  private readonly phaseNext: Phaser.GameObjects.Text;
  private readonly essenceText: Phaser.GameObjects.Text;
  private readonly sardineIcon: Phaser.GameObjects.Image;
  private readonly sardineText: Phaser.GameObjects.Text;
  private readonly starIcon: Phaser.GameObjects.Image;
  private readonly starText: Phaser.GameObjects.Text;
  private readonly sanityLabel: Phaser.GameObjects.Text;
  private readonly sanityFill: Phaser.GameObjects.Rectangle;
  private readonly depthText: Phaser.GameObjects.Text;
  private readonly pageSlots: Phaser.GameObjects.Image[] = [];
  private readonly awakenFill: Phaser.GameObjects.Rectangle;
  readonly awakenButton: Button;
  readonly grimoireButton: Button;
  private shownPhase = '';

  constructor(
    scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly getSim: () => RunSim,
    onGrimoire: () => void,
  ) {
    const serif = { fontFamily: 'Georgia, serif', stroke: toCss(palette.outline) };
    const cx = display.width / 2;

    // Фаза звёзд — сверху по центру: название с таймером, эффект, прогноз.
    this.phaseIcon = fit(unitImage(scene, 'phase_quiet', cx - 150, 44), 50);
    this.phaseName = scene.add
      .text(cx - 116, 24, '', {
        ...serif,
        fontSize: '22px',
        color: toCss(palette.parchment),
        strokeThickness: 5,
      })
      .setOrigin(0, 0.5);
    this.phaseLeft = scene.add
      .text(cx - 116, 48, '', {
        ...serif,
        fontSize: '15px',
        color: toCss(palette.fog),
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5);
    this.phaseNextIcon = fit(unitImage(scene, 'phase_quiet', cx - 106, 72), 20);
    this.phaseNext = scene.add
      .text(cx - 92, 72, '', {
        ...serif,
        fontSize: '15px',
        color: toCss(palette.fog),
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5);

    // Валюты мета-систем — под плашкой дублонов.
    const rowY = 150;
    fit(unitImage(scene, 'icon_essence', MARGIN + 10, rowY), ICON_H);
    this.essenceText = scene.add
      .text(MARGIN + 28, rowY, '', {
        ...serif,
        fontSize: '20px',
        color: toCss(palette.violetLightUi),
        strokeThickness: 5,
      })
      .setOrigin(0, 0.5);
    this.sardineIcon = fit(unitImage(scene, 'icon_sardine', MARGIN + 110, rowY), ICON_H * 0.8);
    this.sardineText = scene.add
      .text(MARGIN + 130, rowY, '', {
        ...serif,
        fontSize: '20px',
        color: toCss(palette.fog),
        strokeThickness: 5,
      })
      .setOrigin(0, 0.5);
    this.starIcon = fit(unitImage(scene, 'icon_darkstar', MARGIN + 200, rowY), ICON_H);
    this.starText = scene.add
      .text(MARGIN + 218, rowY, '', {
        ...serif,
        fontSize: '20px',
        color: toCss(palette.bioCyan),
        strokeThickness: 5,
      })
      .setOrigin(0, 0.5);

    // Рассудок.
    const sy = 184;
    this.sanityLabel = scene.add
      .text(MARGIN, sy, '', {
        fontFamily: 'sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: toCss(palette.parchment),
        stroke: toCss(palette.outline),
        strokeThickness: 4,
      })
      .setOrigin(0, 0.5);
    scene.add
      .rectangle(MARGIN + 92, sy, SANITY_W + 6, SANITY_H + 6, palette.outline)
      .setOrigin(0, 0.5);
    this.sanityFill = scene.add
      .rectangle(MARGIN + 95, sy, SANITY_W, SANITY_H, palette.seaGreen)
      .setOrigin(0, 0.5);

    // Глубина и страницы — справа под дистанцией.
    this.depthText = scene.add
      .text(display.width - MARGIN, 64, '', {
        ...serif,
        fontSize: '20px',
        color: toCss(palette.violetLightUi),
        strokeThickness: 5,
      })
      .setOrigin(1, 0.5);
    for (let i = 0; i < dreamConfig.pagesNeeded; i++) {
      const slot = fit(
        unitImage(scene, 'pickup_page', display.width - MARGIN - 14 - i * 34, 104),
        32,
      );
      this.pageSlots.unshift(slot);
    }

    // Пробуждение — снизу слева: шкала и кнопка.
    const ay = display.height - MARGIN - 32;
    scene.add.rectangle(MARGIN, ay - 44, AWAKEN_W + 6, 14, palette.outline).setOrigin(0, 0.5);
    this.awakenFill = scene.add
      .rectangle(MARGIN + 3, ay - 44, AWAKEN_W, 8, palette.bioCyan)
      .setOrigin(0, 0.5);
    this.awakenButton = new Button(
      scene,
      MARGIN + AWAKEN_W / 2 + 3,
      ay,
      AWAKEN_W,
      54,
      t('hud.awaken'),
      {
        fontSize: 20,
      },
    ).onClick(() => this.getSim().activateAwakening());

    this.grimoireButton = new Button(
      scene,
      display.width - MARGIN - 80 - 188,
      display.height - MARGIN - 32,
      176,
      60,
      t('hud.grimoire'),
      { fontSize: 22, fill: palette.parchmentShade },
    ).onClick(onGrimoire);
  }

  update(time: number): void {
    const s = this.session;
    const state = s.state;
    const sim = this.getSim();

    const phase = s.phase;
    if (phase) {
      if (phase.id !== this.shownPhase) {
        this.shownPhase = phase.id;
        this.phaseIcon.setTexture(`phase_${phase.id}`);
        fit(this.phaseIcon, 50);
        setText(this.phaseLeft, tId(`phase.${phase.id}.desc`));
      }
      const left = Math.max(0, Math.ceil(phase.secondsLeft));
      setText(
        this.phaseName,
        `${tId(`phase.${phase.id}`)} · ${t('hud.phaseLeft', { time: clock(left) })}`,
      );
      const next = s.stars.next(Date.now());
      this.phaseNextIcon.setTexture(`phase_${next}`);
      fit(this.phaseNextIcon, 20);
      setText(this.phaseNext, t('hud.phaseNext', { name: tId(`phase.${next}`) }));
    }

    setText(this.essenceText, formatNumber(Math.floor(state.essence)));
    const showSardines = state.cat.unlocked || state.sardines > 0;
    this.sardineIcon.setVisible(showSardines);
    this.sardineText.setVisible(showSardines);
    setText(this.sardineText, String(state.sardines));
    const showStars = state.darkStars > 0;
    this.starIcon.setVisible(showStars);
    this.starText.setVisible(showStars);
    setText(this.starText, String(state.darkStars));

    const sanity = sim.sanity.value;
    setText(this.sanityLabel, `${t('hud.sanity')} ${Math.round(sanity)}`);
    this.sanityFill
      .setScale(Math.max(0.001, sanity / sanityConfig.max), 1)
      .setFillStyle(
        sanity < sanityConfig.invisibleAt
          ? palette.coral
          : sanity < sanityConfig.distortAt
            ? palette.sicklyViolet
            : palette.seaGreen,
      );
    // Мерцание при «Прозрении».
    this.sanityFill.setAlpha(sim.insightLeft > 0 ? 0.5 + 0.5 * Math.sin(time / 60) : 1);

    setText(this.depthText, t('hud.depth', { depth: state.depth }));
    this.pageSlots.forEach((slot, i) => slot.setAlpha(i < sim.pages ? 1 : 0.25));

    const awakening = sim.awakening;
    const meter = awakening ? sim.awakenLeft / Math.max(sim.awakenTotal, 0.001) : sim.awakenMeter;
    this.awakenFill
      .setScale(Math.max(0.001, Math.min(1, meter)), 1)
      .setFillStyle(awakening ? palette.sicklyViolet : palette.bioCyan);
    const ready = sim.awakenMeter >= 1 && !awakening;
    this.awakenButton
      .setEnabled(ready)
      .setLabel(
        awakening
          ? `${Math.ceil(sim.awakenLeft)}`
          : ready
            ? t('hud.awaken')
            : `${Math.floor(sim.awakenMeter * 100)}%`,
      );
    this.awakenButton.setScale(ready ? 1 + 0.05 * Math.sin(time / 120) : 1);
  }
}

/** 135 → «2:15». */
function clock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
