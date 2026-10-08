import Phaser from 'phaser';
import { app } from '../app';
import display from '../config/display.json';
import { GRIMOIRE_CHAPTERS, type GrimoireChapter, type GrimoireNodeConfig } from '../config';
import { t, tId } from '../i18n';
import { palette, toCss } from '../render/palette';
import { addPanel, Button } from '../render/ui/Button';
import { describeEffect } from '../render/ui/effects';
import type { GameSession } from '../systems/GameSession';
import type { NodeState } from '../systems/Grimoire';

const W = 1180;
const H = 680;
const X0 = (display.width - W) / 2;
const Y0 = (display.height - H) / 2;
const PAD = 44;
const GRID_X = X0 + 150;
const GRID_Y = Y0 + 196;
const COL_STEP = 175;
const ROW_STEP = 118;
const NODE_R = 30;
const SLIDE_MS = 200;

/** Цвет сигила по главе — у каждой главы своя «чернильная» гамма. */
const CHAPTER_COLOR: Record<GrimoireChapter, number> = {
  hunter: palette.coral,
  dreamer: palette.bioCyan,
  winged: palette.sicklyViolet,
};

interface NodeView {
  cfg: GrimoireNodeConfig;
  circle: Phaser.GameObjects.Arc;
  glyph: Phaser.GameObjects.Text;
}

const textStyle = (
  size: number,
  color: number,
  bold = false,
): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: 'sans-serif',
  fontSize: `${size}px`,
  fontStyle: bold ? 'bold' : 'normal',
  color: toCss(color),
});

/**
 * Запретный гримуар (SPEC §6): три главы-страницы, узлы-сигилы со связями; покупка за Эссенцию.
 * Отсюда же — Погружение с выбором знамения.
 */
export class GrimoireScene extends Phaser.Scene {
  private session!: GameSession;
  private root!: Phaser.GameObjects.Container;
  private chapter: GrimoireChapter = 'hunter';
  private selected: GrimoireNodeConfig | null = null;
  private page!: Phaser.GameObjects.Container;
  private links!: Phaser.GameObjects.Graphics;
  private nodeViews: NodeView[] = [];
  private chapterButtons = new Map<GrimoireChapter, Button>();
  private currencyText!: Phaser.GameObjects.Text;
  private detailTitle!: Phaser.GameObjects.Text;
  private detailText!: Phaser.GameObjects.Text;
  private learnButton!: Button;
  private diveButton!: Button;
  private diveModal: Phaser.GameObjects.Container | null = null;
  private isOpen = false;

  constructor() {
    super('GrimoireScene');
  }

  get opened(): boolean {
    return this.isOpen;
  }

  create(): void {
    this.session = app().session;
    this.nodeViews = [];
    this.chapterButtons.clear();
    this.isOpen = false;
    this.diveModal = null;

    this.root = this.add.container(0, display.height + 40).setVisible(false);
    const shade = this.add
      .rectangle(-X0, -Y0, display.width, display.height, palette.nightSky, 0.55)
      .setOrigin(0)
      .setInteractive();
    shade.setPosition(0, 0);
    const panel = addPanel(this, X0, Y0, W, H);
    this.root.add([shade, panel]);

    this.root.add(
      this.add
        .text(X0 + PAD, Y0 + 56, t('grimoire.title'), {
          fontFamily: 'Georgia, serif',
          fontSize: '32px',
          fontStyle: 'bold',
          color: toCss(palette.ink),
        })
        .setOrigin(0, 0.5),
    );
    this.currencyText = this.add
      .text(X0 + 440, Y0 + 56, '', textStyle(20, palette.inkSoft, true))
      .setOrigin(0, 0.5);
    this.root.add(this.currencyText);

    this.diveButton = new Button(this, X0 + W - 300, Y0 + 56, 230, 50, '', {
      fontSize: 18,
    }).onClick(() => this.openDive());
    const close = new Button(this, X0 + W - PAD - 20, Y0 + 56, 48, 48, '✕', {
      fill: palette.parchmentShade,
      fontSize: 24,
      icon: 'ui_close',
      badge: true,
    }).onClick(() => this.close());
    this.root.add([this.diveButton, close]);

    GRIMOIRE_CHAPTERS.forEach((ch, i) => {
      const b = new Button(
        this,
        X0 + PAD + 95 + i * 200,
        Y0 + 118,
        185,
        46,
        t(`grimoire.chapter.${ch}`),
        {
          fontSize: 18,
        },
      ).onClick(() => this.setChapter(ch));
      this.chapterButtons.set(ch, b);
      this.root.add(b);
    });

    this.page = this.add.container(0, 0);
    this.links = this.add.graphics();
    this.page.add(this.links);
    this.root.add(this.page);

    const detailY = Y0 + H - 118;
    this.detailTitle = this.add
      .text(X0 + PAD, detailY, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: toCss(palette.ink),
      })
      .setOrigin(0, 0.5);
    this.detailText = this.add
      .text(X0 + PAD, detailY + 40, '', textStyle(18, palette.inkSoft))
      .setOrigin(0, 0.5)
      .setWordWrapWidth(W - 420);
    this.learnButton = new Button(
      this,
      X0 + W - PAD - 130,
      detailY + 20,
      250,
      60,
      t('grimoire.learn'),
      {
        fontSize: 18,
      },
    ).onClick(() => {
      if (this.selected && this.session.buyNode(this.selected.id)) this.refresh();
    });
    this.root.add([this.detailTitle, this.detailText, this.learnButton]);

    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.setChapter('hunter');
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.root.setVisible(true);
    this.refresh();
    this.tweens.killTweensOf(this.root);
    this.tweens.add({ targets: this.root, y: 0, duration: SLIDE_MS, ease: 'Cubic.easeOut' });
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.closeDive();
    this.tweens.killTweensOf(this.root);
    this.tweens.add({
      targets: this.root,
      y: display.height + 40,
      duration: SLIDE_MS,
      ease: 'Cubic.easeIn',
      onComplete: () => this.root.setVisible(false),
    });
  }

  private setChapter(ch: GrimoireChapter): void {
    this.chapter = ch;
    this.selected = null;
    for (const [id, b] of this.chapterButtons) {
      b.setFill(id === ch ? palette.lanternAmber : palette.parchmentShade);
    }
    for (const v of this.nodeViews) {
      v.circle.destroy();
      v.glyph.destroy();
    }
    this.nodeViews = [];
    const color = CHAPTER_COLOR[ch];
    for (const cfg of this.session.grimoire.nodes) {
      if (cfg.chapter !== ch) continue;
      const { x, y } = nodePos(cfg);
      const circle = this.add.circle(x, y, NODE_R, palette.parchmentLight).setStrokeStyle(4, color);
      circle.setInteractive({ useHandCursor: true });
      circle.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        this.selected = cfg;
        this.refresh();
      });
      // Сигил — созвездие-символ главы; у узлов «за звёзды» — звезда.
      const glyph = this.add
        .text(x, y, cfg.darkStars ? '★' : SIGIL[ch], textStyle(26, color, true))
        .setOrigin(0.5);
      this.page.add([circle, glyph]);
      this.nodeViews.push({ cfg, circle, glyph });
    }
    this.refresh();
  }

  private refresh(): void {
    const s = this.session;
    const owned = s.ownedNodes();
    const stars = s.state.darkStars;
    this.currencyText.setText(`◆ ${Math.floor(s.state.essence)}    ★ ${stars}`);

    this.links.clear();
    for (const v of this.nodeViews) {
      const a = nodePos(v.cfg);
      for (const req of v.cfg.requires) {
        const r = s.grimoire.node(req);
        const b = nodePos(r);
        const lit = owned.has(req);
        this.links.lineStyle(
          lit ? 5 : 3,
          lit ? CHAPTER_COLOR[this.chapter] : palette.parchmentShade,
          lit ? 0.9 : 0.6,
        );
        this.links.lineBetween(b.x, b.y, a.x, a.y);
      }
    }
    for (const v of this.nodeViews) {
      const state: NodeState = s.grimoire.state(v.cfg.id, owned, stars);
      const color = CHAPTER_COLOR[this.chapter];
      const isSel = this.selected?.id === v.cfg.id;
      v.circle
        .setFillStyle(
          state === 'owned'
            ? color
            : state === 'available'
              ? palette.parchmentLight
              : palette.inkSoft,
        )
        .setStrokeStyle(isSel ? 7 : 4, isSel ? palette.lanternAmber : color)
        .setAlpha(state === 'locked' ? 0.55 : 1);
      v.glyph
        .setColor(toCss(state === 'owned' ? palette.parchmentLight : color))
        .setAlpha(state === 'locked' ? 0.5 : 1);
    }

    const sel = this.selected;
    if (!sel) {
      this.detailTitle.setText(t('grimoire.pick'));
      this.detailText.setText('');
      this.learnButton.setVisible(false);
    } else {
      const state = s.grimoire.state(sel.id, owned, stars);
      this.detailTitle.setText(describeEffect(sel));
      const notes = [t('grimoire.cost', { cost: sel.cost })];
      if (sel.darkStars) notes.push(t('grimoire.needStars', { stars: sel.darkStars }));
      if (sel.keep) notes.push(t('grimoire.keep'));
      this.detailText.setText(notes.join(' · '));
      this.learnButton.setVisible(true);
      if (state === 'owned') {
        this.learnButton.setLabel(t('grimoire.owned')).setEnabled(false);
      } else if (state === 'locked') {
        this.learnButton.setLabel(t('grimoire.locked')).setEnabled(false);
      } else {
        this.learnButton
          .setLabel(t('grimoire.learn'))
          .setEnabled(s.grimoire.canBuy(sel.id, owned, stars, s.state.essence));
      }
    }

    const gain = s.darkStarsAvailable;
    this.diveButton
      .setLabel(gain > 0 ? t('dive.buttonStars', { stars: gain }) : t('dive.button'))
      .setEnabled(s.canDive);
  }

  override update(): void {
    // Эссенция копится и при открытом гримуаре (забег идёт) — обновляем подписи раз в кадр.
    if (this.isOpen && !this.diveModal) this.refresh();
  }

  // --- Погружение ---

  private openDive(): void {
    if (this.diveModal || !this.session.canDive) return;
    const s = this.session;
    const gain = s.darkStarsAvailable;
    const total = s.state.darkStars + gain;
    const mult = 1 + s.economyCfg.prestige.starBonus * total;
    const cx = display.width / 2;
    const cy = display.height / 2;
    const MW = 900;
    const MH = 560;
    const modal = this.add.container(0, 0).setDepth(10);
    const shade = this.add
      .rectangle(0, 0, display.width, display.height, palette.nightSky, 0.6)
      .setOrigin(0)
      .setInteractive();
    const panel = addPanel(this, cx - MW / 2, cy - MH / 2, MW, MH);
    const ink = toCss(palette.ink);
    const lines = [
      this.add
        .text(cx, cy - 210, t('dive.title', { depth: s.state.depth + 1 }), {
          fontFamily: 'Georgia, serif',
          fontSize: '32px',
          fontStyle: 'bold',
          color: ink,
        })
        .setOrigin(0.5),
      this.add
        .text(
          cx,
          cy - 160,
          t('dive.gain', { stars: gain, total, mult: mult.toFixed(1) }),
          textStyle(20, palette.ink, true),
        )
        .setOrigin(0.5),
      this.add.text(cx, cy - 124, t('dive.reset'), textStyle(16, palette.inkSoft)).setOrigin(0.5),
      this.add.text(cx, cy - 98, t('dive.keep'), textStyle(16, palette.inkSoft)).setOrigin(0.5),
      this.add
        .text(cx, cy - 56, t('dive.chooseOmen'), textStyle(20, palette.ink, true))
        .setOrigin(0.5),
    ];
    modal.add([shade, panel, ...lines]);
    s.omenChoices().forEach((omen, i) => {
      const x = cx + (i - 1) * 280;
      const card = new Button(this, x, cy + 60, 250, 150, '', {
        fill: palette.parchmentLight,
        fontSize: 16,
        radius: 16,
        plain: true,
      }).onClick(() => {
        if (this.session.dive(omen.id)) {
          this.closeDive();
          this.close();
          // Новая глубина — новый забег с нуля.
          this.scene.get('RunScene').scene.restart();
        }
      });
      const name = this.add
        .text(x, cy + 20, tId(`omen.${omen.id}`), {
          fontFamily: 'Georgia, serif',
          fontSize: '20px',
          fontStyle: 'bold',
          color: ink,
          align: 'center',
          wordWrap: { width: 220 },
        })
        .setOrigin(0.5);
      const desc = this.add
        .text(x, cy + 76, tId(`omen.${omen.id}.desc`), {
          ...textStyle(16, palette.inkSoft),
          align: 'center',
          wordWrap: { width: 220 },
        })
        .setOrigin(0.5);
      modal.add([card, name, desc]);
    });
    const cancel = new Button(this, cx, cy + MH / 2 - 56, 220, 50, t('dive.cancel'), {
      fill: palette.parchmentShade,
      fontSize: 18,
    }).onClick(() => this.closeDive());
    modal.add(cancel);
    this.diveModal = modal;
  }

  private closeDive(): void {
    this.diveModal?.destroy();
    this.diveModal = null;
  }
}

/** Символы-сигилы глав (созвездия-глифы, SPEC §6). */
const SIGIL: Record<GrimoireChapter, string> = {
  hunter: '✦',
  dreamer: '☽',
  winged: '✵',
};

function nodePos(cfg: GrimoireNodeConfig): { x: number; y: number } {
  return { x: GRID_X + cfg.col * COL_STEP, y: GRID_Y + cfg.row * ROW_STEP };
}
