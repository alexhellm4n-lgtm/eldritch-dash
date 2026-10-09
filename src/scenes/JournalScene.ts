import Phaser from 'phaser';
import { app } from '../app';
import display from '../config/display.json';
import { biomesConfig, enemiesConfig, journalConfig, progressionConfig } from '../config';
import { formatNumber } from '../core/BigNum';
import { t, tId } from '../i18n';
import { createCreaturePortrait } from '../render/EntityViews';
import { palette, toCss } from '../render/palette';
import { addPanel, Button } from '../render/ui/Button';
import { shareImage } from '../render/ui/share';
import { isRaster } from '../render/textures';
import { ACHIEVEMENT_STATS } from '../systems/Achievements';
import type { GameSession } from '../systems/GameSession';

const W = 1180;
const H = 680;
const X0 = (display.width - W) / 2;
const Y0 = (display.height - H) / 2;
const PAD = 44;
const SLIDE_MS = 200;
const COLS = 5;
const CARD = 112;
const CARD_GAP = 12;
const GRID_X = X0 + PAD;
const GRID_Y = Y0 + 150;
const DETAIL_X = GRID_X + COLS * (CARD + CARD_GAP) + 20;
const DETAIL_W = X0 + W - PAD - DETAIL_X;
/** Тон «зарисовки на пожелтевшей бумаге» и силуэта незнакомой твари. */
const SKETCH_TINT = 0xd9c49a;
const UNKNOWN_TINT = 0x2b2238;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

type Tab = 'bestiary' | 'achievements';

const text = (
  size: number,
  color: number,
  bold = false,
): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: 'sans-serif',
  fontSize: `${size}px`,
  fontStyle: bold ? 'bold' : 'normal',
  color: toCss(color),
});

/** Размер твари в игровых единицах (для вписывания портрета). */
function creatureSize(id: string): { w: number; h: number } {
  const e = enemiesConfig[id];
  if (e) return { w: e.width, h: e.height };
  const b = progressionConfig.bosses[id];
  return b ? { w: b.width, h: b.height } : { w: 100, h: 100 };
}

/** Тонирует все картинки внутри контейнера (зарисовка, силуэт). */
function tintDeep(obj: Phaser.GameObjects.GameObject, tint: number): void {
  if (obj instanceof Phaser.GameObjects.Container) {
    for (const child of obj.list) tintDeep(child, tint);
  } else if (obj instanceof Phaser.GameObjects.Image) {
    obj.setTint(tint);
  }
}

/**
 * Дневник исследователя (SPEC §6): бестиарий с карточками-зарисовками и записями учёного,
 * кнопка «Поделиться» (PNG-карточка) и вкладка достижений.
 */
export class JournalScene extends Phaser.Scene {
  private session!: GameSession;
  private root!: Phaser.GameObjects.Container;
  private content!: Phaser.GameObjects.Container;
  private tabButtons = new Map<Tab, Button>();
  private summary!: Phaser.GameObjects.Text;
  private tab: Tab = 'bestiary';
  private selected = journalConfig.creatures[0]!;
  private isOpen = false;
  private sharing = false;

  constructor() {
    super('JournalScene');
  }

  get opened(): boolean {
    return this.isOpen;
  }

  create(): void {
    this.session = app().session;
    this.isOpen = false;
    this.tabButtons.clear();

    this.root = this.add.container(0, display.height + 40).setVisible(false);
    const shade = this.add
      .rectangle(0, 0, display.width, display.height, palette.nightSky, 0.55)
      .setOrigin(0)
      .setInteractive();
    this.root.add([shade, addPanel(this, X0, Y0, W, H)]);
    this.root.add(
      this.add
        .text(X0 + PAD, Y0 + 56, t('journal.title'), {
          fontFamily: 'Georgia, serif',
          fontSize: '32px',
          fontStyle: 'bold',
          color: toCss(palette.ink),
        })
        .setOrigin(0, 0.5),
    );
    this.summary = this.add
      .text(X0 + W - PAD - 70, Y0 + 56, '', text(17, palette.inkSoft, true))
      .setOrigin(1, 0.5);
    const close = new Button(this, X0 + W - PAD - 20, Y0 + 56, 48, 48, '✕', {
      fill: palette.parchmentShade,
      fontSize: 24,
      icon: 'ui_close',
      badge: true,
    }).onClick(() => this.close());
    this.root.add([this.summary, close]);

    (['bestiary', 'achievements'] as const).forEach((tab, i) => {
      const b = new Button(
        this,
        X0 + PAD + 95 + i * 200,
        Y0 + 112,
        185,
        44,
        t(`journal.tab.${tab}`),
        { fontSize: 18 },
      ).onClick(() => {
        this.tab = tab;
        this.refresh();
      });
      this.tabButtons.set(tab, b);
      this.root.add(b);
    });

    this.content = this.add.container(0, 0);
    this.root.add(this.content);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
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
    this.tweens.killTweensOf(this.root);
    this.tweens.add({
      targets: this.root,
      y: display.height + 40,
      duration: SLIDE_MS,
      ease: 'Cubic.easeIn',
      onComplete: () => this.root.setVisible(false),
    });
  }

  private refresh(): void {
    for (const [tab, b] of this.tabButtons) {
      b.setFill(tab === this.tab ? palette.lanternAmber : palette.parchmentShade);
    }
    this.content.removeAll(true);
    if (this.tab === 'bestiary') this.buildBestiary();
    else this.buildAchievements();
  }

  /** Пергаментная карточка (растр) или векторная рамка; выбранная — теплее и с фиолетовой каймой. */
  private cardBg(
    x: number,
    y: number,
    w: number,
    h: number,
    selected: boolean,
  ): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle {
    if (isRaster('ui_card')) {
      if (selected) {
        this.content.add(
          this.add.rectangle(x - 4, y - 4, w + 8, h + 8, palette.sicklyViolet, 0.85).setOrigin(0),
        );
      }
      const img = this.add.image(x, y, 'ui_card').setOrigin(0).setDisplaySize(w, h);
      this.content.add(img);
      return img;
    }
    const rect = this.add
      .rectangle(x, y, w, h, palette.parchmentLight)
      .setOrigin(0)
      .setStrokeStyle(selected ? 5 : 3, selected ? palette.sicklyViolet : palette.inkSoft);
    this.content.add(rect);
    return rect;
  }

  // --- Бестиарий ---

  private buildBestiary(): void {
    const s = this.session;
    const counts = s.state.journal;
    const j = s.journal;
    this.summary.setText(
      t('journal.summary', {
        found: j.discovered(counts),
        total: journalConfig.creatures.length,
        full: j.fullCount(counts),
      }),
    );

    journalConfig.creatures.forEach((id, i) => {
      const x = GRID_X + (i % COLS) * (CARD + CARD_GAP);
      const y = GRID_Y + Math.floor(i / COLS) * (CARD + CARD_GAP);
      const st = j.state(id, counts);
      const card = this.cardBg(x, y, CARD, CARD, id === this.selected);
      card.setInteractive({ useHandCursor: true });
      card.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        this.selected = id;
        this.refresh();
      });
      this.content.add(card);
      this.content.add(this.portrait(id, st, x + CARD / 2, y + CARD / 2 - 6, CARD - 22, CARD - 34));
      const label = this.add
        .text(
          x + CARD / 2,
          y + CARD - 12,
          st === 'unknown' ? t('journal.unknown') : '',
          text(11, palette.inkSoft, true),
        )
        .setOrigin(0.5);
      this.content.add(label);
      if (st === 'full') {
        this.content.add(
          this.add
            .text(x + CARD - 14, y + 14, '★', text(20, palette.lanternAmber, true))
            .setOrigin(0.5),
        );
      }
    });

    this.buildDetail(this.selected);
  }

  private portrait(
    id: string,
    st: 'unknown' | 'partial' | 'full',
    x: number,
    y: number,
    maxW: number,
    maxH: number,
  ): Phaser.GameObjects.Container {
    const size = creatureSize(id);
    const p = createCreaturePortrait(this, id, size.w, size.h);
    // Вписываем по реальным границам рисунка: крылья и короны выходят за хитбокс.
    const bounds = p.getBounds();
    const k = Math.min(maxW / Math.max(1, bounds.width), maxH / Math.max(1, bounds.height));
    p.setScale(k).setPosition(x - bounds.centerX * k, y - bounds.centerY * k);
    if (st === 'unknown') {
      tintDeep(p, UNKNOWN_TINT);
      p.setAlpha(0.75);
    } else {
      tintDeep(p, SKETCH_TINT);
    }
    return p;
  }

  private buildDetail(id: string): void {
    const s = this.session;
    const counts = s.state.journal;
    const st = s.journal.state(id, counts);
    const known = st !== 'unknown';
    const cx = DETAIL_X + DETAIL_W / 2;
    const frame = this.cardBg(DETAIL_X, GRID_Y, DETAIL_W, 230, false);
    this.content.add(frame);
    this.content.add(this.portrait(id, st, cx, GRID_Y + 115, DETAIL_W - 40, 200));

    const title = this.add
      .text(DETAIL_X, GRID_Y + 258, known ? tId(`creature.${id}`) : t('journal.unknown'), {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: toCss(palette.ink),
      })
      .setOrigin(0, 0.5);
    this.content.add(title);
    const n = counts[id] ?? 0;
    const need = s.journal.needed(id);
    const bossBiome = Object.entries(biomesConfig).find(([, b]) => b.boss === id)?.[0];
    const meta = [
      t('journal.progress', { n: Math.min(n, need), need }),
      bossBiome ? t('journal.boss', { biome: tId(`biome.${bossBiome}`) }) : '',
    ]
      .filter(Boolean)
      .join(' · ');
    this.content.add(
      this.add
        .text(DETAIL_X, GRID_Y + 288, meta, text(15, palette.inkSoft, true))
        .setOrigin(0, 0.5),
    );
    this.content.add(
      this.add
        .text(DETAIL_X, GRID_Y + 308, known ? tId(`journal.${id}`) : t('journal.unknownNote'), {
          fontFamily: 'Georgia, serif',
          fontSize: '17px',
          fontStyle: 'italic',
          color: toCss(palette.ink),
          lineSpacing: 4,
        })
        .setOrigin(0, 0)
        .setWordWrapWidth(DETAIL_W),
    );
    if (st === 'full') {
      this.content.add(
        this.add
          .text(DETAIL_X, GRID_Y + 432, t('journal.fullBonus'), text(15, palette.seaGreen, true))
          .setOrigin(0, 0.5),
      );
    }
    const share = new Button(this, X0 + W - PAD - 100, Y0 + H - 64, 190, 54, t('journal.share'), {
      fontSize: 18,
      icon: 'icon_share',
    }).onClick(() => void this.share(id));
    share.setEnabled(known && !this.sharing);
    this.content.add(share);
  }

  /** Карточка-PNG: зарисовка, имя, запись и ссылка на игру (canvas → blob → share/скачать). */
  private async share(id: string): Promise<void> {
    if (this.sharing) return;
    this.sharing = true;
    const { width: CW, height: CH, url } = journalConfig.share;
    const OFF = -10000;
    const card = this.add.container(OFF, 0);
    card.add(addPanel(this, 0, 0, CW, CH));
    card.add(
      this.add
        .text(CW / 2, 64, t('journal.title'), {
          fontFamily: 'Georgia, serif',
          fontSize: '30px',
          fontStyle: 'bold',
          color: toCss(palette.inkSoft),
        })
        .setOrigin(0.5),
    );
    card.add(this.portrait(id, 'partial', CW / 2, 250, CW - 140, 260));
    card.add(
      this.add
        .text(CW / 2, 418, tId(`creature.${id}`), {
          fontFamily: 'Georgia, serif',
          fontSize: '34px',
          fontStyle: 'bold',
          color: toCss(palette.ink),
        })
        .setOrigin(0.5),
    );
    card.add(
      this.add
        .text(CW / 2, 460, tId(`journal.${id}`), {
          fontFamily: 'Georgia, serif',
          fontSize: '20px',
          fontStyle: 'italic',
          color: toCss(palette.ink),
          align: 'center',
          lineSpacing: 6,
        })
        .setOrigin(0.5, 0)
        .setWordWrapWidth(CW - 120),
    );
    card.add(
      this.add
        .text(CW / 2, CH - 96, t('game.title'), {
          fontFamily: 'Georgia, serif',
          fontSize: '30px',
          fontStyle: 'bold',
          color: toCss(palette.lanternAmber),
          stroke: toCss(palette.outline),
          strokeThickness: 6,
        })
        .setOrigin(0.5),
    );
    card.add(this.add.text(CW / 2, CH - 58, url, text(16, palette.inkSoft, true)).setOrigin(0.5));

    const rt = this.add.renderTexture(0, 0, CW, CH).setVisible(false);
    rt.draw(card, -OFF, 0);
    rt.render();
    const image = await new Promise<HTMLImageElement | null>((resolve) =>
      rt.snapshot((img) => resolve(img instanceof HTMLImageElement ? img : null)),
    );
    card.destroy();
    rt.destroy();
    if (image) {
      await shareImage(
        image,
        `eldritch-dash-${id}.png`,
        t('game.title'),
        `${tId(`creature.${id}`)} — ${url}`,
      );
    }
    this.sharing = false;
    if (this.isOpen) this.refresh();
  }

  // --- Достижения ---

  private buildAchievements(): void {
    const s = this.session;
    const owned = new Set(s.state.achievements);
    const list = s.achievements.list;
    const bonus = Math.round((s.achievementMult - 1) * 100);
    this.summary.setText(t('journal.achSummary', { n: owned.size, total: list.length, bonus }));

    const colW = (W - PAD * 2 - 20) / 2;
    const rowH = 48;
    ACHIEVEMENT_STATS.forEach((stat, i) => {
      const tiers = list.filter((a) => a.stat === stat);
      if (tiers.length === 0) return;
      const x = GRID_X + (i % 2) * (colW + 20);
      const y = GRID_Y - 4 + Math.floor(i / 2) * rowH;
      const done = tiers.filter((a) => owned.has(a.id)).length;
      const next = tiers[Math.min(done, tiers.length - 1)]!;
      const target = formatNumber(next.target);
      this.content.add(
        this.add
          .text(
            x,
            y + 12,
            t('ach.name', {
              name: tId(`ach.${stat}`),
              tier: ROMAN[Math.min(done, tiers.length - 1)] ?? '',
            }),
            text(16, palette.ink, true),
          )
          .setOrigin(0, 0.5),
      );
      this.content.add(
        this.add
          .text(
            x,
            y + 32,
            tId(`ach.${stat}.desc`, { n: target }),
            text(13, done === tiers.length ? palette.seaGreen : palette.inkSoft),
          )
          .setOrigin(0, 0.5),
      );
      tiers.forEach((a, k) => {
        const got = owned.has(a.id);
        const px = x + colW - 14 - (tiers.length - 1 - k) * 26;
        if (isRaster('icon_star') && isRaster('ui_seal')) {
          // Полученный тир — звезда, неполученный — пустая печать.
          const img = this.add.image(px, y + 20, got ? 'icon_star' : 'ui_seal');
          img.setDisplaySize(got ? 24 : 20, got ? 24 : 20).setAlpha(got ? 1 : 0.75);
          this.content.add(img);
          return;
        }
        const pip = this.add
          .circle(px, y + 20, 9, got ? palette.lanternAmber : palette.parchmentLight)
          .setStrokeStyle(2.5, got ? palette.outline : palette.inkSoft);
        this.content.add(pip);
      });
    });
  }
}
