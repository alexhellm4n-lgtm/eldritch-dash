import type Phaser from 'phaser';
import display from '../../config/display.json';
import { dreamConfig, sanityConfig } from '../../config';
import { formatNumber } from '../../core/BigNum';
import { t, tId } from '../../i18n';
import type { GameSession } from '../../systems/GameSession';
import type { RunSim } from '../../systems/RunSim';
import { palette, toCss } from '../palette';
import { unitImage } from '../textures';
import { Bar } from './Bar';
import { Button } from './Button';

const MARGIN = 24;
const SANITY_W = 220;
const SANITY_H = 14;
const ICON_H = 24;
const AWAKEN_W = 220;
const WORLD_W = 320;
const WORLD_Y = 104;
const BOTTOM_BTN_W = 176;
const BOTTOM_STEP = 188;

function fit(img: Phaser.GameObjects.Image, height: number): Phaser.GameObjects.Image {
  return img.setScale(height / (img.height || 1));
}

/** Вписать картинку в прямоугольник (для вытянутых значков). */
function fitBox(
  img: Phaser.GameObjects.Image,
  width: number,
  height: number,
): Phaser.GameObjects.Image {
  return img.setScale(Math.min(width / (img.width || 1), height / (img.height || 1)));
}

function setText(obj: Phaser.GameObjects.Text, text: string): void {
  if (obj.text !== text) obj.setText(text);
}

export interface MetaHudActions {
  grimoire: () => void;
  town: () => void;
  journal: () => void;
}

/**
 * HUD мета-систем (SPEC §10): фаза звёзд с прогнозом, Эссенция/сардинки/тёмные звёзды,
 * шкала рассудка, глубина, страницы книги, шкала и кнопка Пробуждения, путь по биому
 * и здоровье босса, кнопки гримуара, городка и дневника.
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
  private readonly sanityBar: Bar;
  private readonly depthText: Phaser.GameObjects.Text;
  private readonly pageSlots: Phaser.GameObjects.Image[] = [];
  private readonly awakenBar: Bar;
  readonly awakenButton: Button;
  readonly grimoireButton: Button;
  readonly townButton: Button;
  readonly journalButton: Button;
  private readonly worldText: Phaser.GameObjects.Text;
  private readonly worldBar: Bar;
  private shownPhase = '';

  constructor(
    scene: Phaser.Scene,
    private readonly session: GameSession,
    private readonly getSim: () => RunSim,
    actions: MetaHudActions,
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
    this.sardineIcon = fitBox(
      unitImage(scene, 'icon_sardine', MARGIN + 110, rowY),
      ICON_H * 1.15,
      ICON_H * 0.8,
    );
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
    this.sanityBar = new Bar(
      scene,
      MARGIN + 90,
      sy,
      SANITY_W + 10,
      SANITY_H + 10,
      palette.seaGreen,
    );

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
    this.awakenBar = new Bar(scene, MARGIN, ay - 46, AWAKEN_W + 6, 22, palette.bioCyan);
    this.awakenButton = new Button(
      scene,
      MARGIN + AWAKEN_W / 2 + 3,
      ay,
      AWAKEN_W,
      54,
      t('hud.awaken'),
      { fontSize: 20, icon: 'icon_awaken' },
    ).onClick(() => this.getSim().activateAwakening());

    // Нижний ряд справа налево: (лавка — в UIScene) гримуар, дневник, городок.
    const by = display.height - MARGIN - 32;
    const bx = (i: number): number => display.width - MARGIN - 80 - BOTTOM_STEP * i;
    const bottom = (i: number, label: string, icon: string, onClick: () => void): Button =>
      new Button(scene, bx(i), by, BOTTOM_BTN_W, 60, label, {
        fontSize: 20,
        fill: palette.parchmentShade,
        icon,
      }).onClick(onClick);
    this.grimoireButton = bottom(1, t('hud.grimoire'), 'icon_grimoire', actions.grimoire);
    this.journalButton = bottom(2, t('hud.journal'), 'icon_journal', actions.journal);
    this.townButton = bottom(3, t('hud.town'), 'icon_town', actions.town);

    // Путь по биому / здоровье босса — под фазой звёзд.
    this.worldText = scene.add
      .text(cx, WORLD_Y - 14, '', {
        ...serif,
        fontSize: '16px',
        color: toCss(palette.parchment),
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    this.worldBar = new Bar(
      scene,
      cx - WORLD_W / 2,
      WORLD_Y + 8,
      WORLD_W,
      20,
      palette.lanternAmber,
    );
  }

  /** Путь до босса, а во время боя — здоровье босса и оставшееся время. */
  private updateWorld(sim: RunSim, time: number): void {
    const boss = sim.boss;
    const cfg = sim.bossCfg;
    if (boss && cfg) {
      const left = Math.max(0, Math.ceil(cfg.fightSec - sim.bossTime));
      setText(
        this.worldText,
        `${tId(`creature.${boss.type}`)} · ${t('hud.bossTime', { time: left })}`,
      );
      const hp = Math.max(0, boss.hp) / Math.max(1, sim.bossMaxHp);
      const flash = boss.hurtT < 0.12 ? palette.parchmentLight : palette.coral;
      this.worldBar.setProgress(hp).setColor(flash).setAlpha(1);
      return;
    }
    const biome = tId(`biome.${sim.biomeId}`);
    const lap = sim.lap > 0 ? ` · ${t('hud.lap', { n: sim.lap + 1 })}` : '';
    const toBoss = Math.max(0, Math.ceil(sim.biome.lengthM - sim.biomeProgressM));
    setText(
      this.worldText,
      sim.transitionLeft > 0
        ? biome
        : `${biome}${lap} · ${t('hud.toBoss', { m: formatNumber(toBoss) })}`,
    );
    const k = Math.min(1, sim.biomeProgressM / sim.biome.lengthM);
    // Перед самым боссом полоса тревожно мигает.
    const warn = k > 0.95 ? 0.6 + 0.4 * Math.sin(time / 90) : 1;
    this.worldBar.setProgress(k).setColor(palette.lanternAmber).setAlpha(warn);
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
    this.sanityBar
      .setProgress(sanity / sanityConfig.max)
      .setColor(
        sanity < sanityConfig.invisibleAt
          ? palette.coral
          : sanity < sanityConfig.distortAt
            ? palette.sicklyViolet
            : palette.seaGreen,
      );
    // Мерцание при «Прозрении».
    this.sanityBar.setAlpha(sim.insightLeft > 0 ? 0.5 + 0.5 * Math.sin(time / 60) : 1);

    setText(this.depthText, t('hud.depth', { depth: state.depth }));
    this.pageSlots.forEach((slot, i) => slot.setAlpha(i < sim.pages ? 1 : 0.25));

    const awakening = sim.awakening;
    const meter = awakening ? sim.awakenLeft / Math.max(sim.awakenTotal, 0.001) : sim.awakenMeter;
    this.awakenBar.setProgress(meter).setColor(awakening ? palette.sicklyViolet : palette.bioCyan);
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
    this.updateWorld(sim, time);
  }
}

/** 135 → «2:15». */
function clock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
