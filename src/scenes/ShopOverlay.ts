import Phaser from 'phaser';
import { app } from '../app';
import display from '../config/display.json';
import { formatNumber } from '../core/BigNum';
import { t, tId } from '../i18n';
import { catSkinKey, hasCatSkin } from '../render/CatView';
import { palette, toCss } from '../render/palette';
import { unitImage } from '../render/textures';
import { addPanel, addStrip, Button } from '../render/ui/Button';
import skin from '../render/ui/skin.json';
import type { BuyAmount } from '../systems/Economy';
import type { GameSession } from '../systems/GameSession';

const PANEL_W = 640;
const PANEL_H = display.height - 24;
const OPEN_X = display.width - PANEL_W - 12;
const CLOSED_X = display.width + 24;
/** Внутренний отступ: рамка из щупалец шире прежней обводки. */
const PAD = 40;
const HEADER_Y = 54;
const TABS_Y = 106;
const ROW_W = PANEL_W - PAD * 2;
const ROW_H = 54;
const ROW_GAP = 4;
const ROWS_Y = 138;
const BUY_W = 176;
/** Портрет скина в строке лавки (высота головы кота в единицах ≈ 44). */
const SKIN_THUMB_SCALE = 0.9;
const SKIN_THUMB_W = 50;
const SLIDE_MS = 220;
const AMOUNTS: readonly BuyAmount[] = [1, 10, 100, 'max'];

type Tab = 'items' | 'hero' | 'cat';

interface Row {
  id: string;
  root: Phaser.GameObjects.Container;
  title: Phaser.GameObjects.Text;
  detail: Phaser.GameObjects.Text;
  buy: Button;
}

/** Строка скина: «купить» за сардинки или «надеть». */
interface SkinRow extends Row {
  wear: Button;
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

/** Лавка: выезжающая панель поверх забега (забег не останавливается, SPEC §10). */
export class ShopOverlay extends Phaser.Scene {
  private session!: GameSession;
  private panel!: Phaser.GameObjects.Container;
  private tab: Tab = 'items';
  private amount: BuyAmount = 1;
  private itemRows: Row[] = [];
  private heroRows: Row[] = [];
  private tabButtons = new Map<Tab, Button>();
  private amountButtons = new Map<BuyAmount, Button>();
  private itemsLayer!: Phaser.GameObjects.Container;
  private heroLayer!: Phaser.GameObjects.Container;
  private catLayer!: Phaser.GameObjects.Container;
  private catRows: Row[] = [];
  private catLocked!: Phaser.GameObjects.Text;
  private skinsTitle!: Phaser.GameObjects.Text;
  private skinRows: SkinRow[] = [];
  private isOpen = false;

  constructor() {
    super('ShopOverlay');
  }

  get opened(): boolean {
    return this.isOpen;
  }

  create(): void {
    this.session = app().session;
    this.itemRows = [];
    this.heroRows = [];
    this.catRows = [];
    this.skinRows = [];
    this.tabButtons.clear();
    this.amountButtons.clear();
    this.isOpen = false;

    this.panel = this.add.container(CLOSED_X, 12).setVisible(false);
    const bg = addPanel(this, 0, 0, PANEL_W, PANEL_H);
    // Фон панели перехватывает клики, чтобы они не превращались в прыжки.
    const blocker = this.add.zone(0, 0, PANEL_W, PANEL_H).setOrigin(0).setInteractive();
    this.panel.add([bg, blocker]);

    this.panel.add(
      this.add
        .text(PAD, HEADER_Y, t('shop.title'), {
          fontFamily: 'Georgia, serif',
          fontSize: '26px',
          fontStyle: 'bold',
          color: toCss(palette.ink),
        })
        .setOrigin(0, 0.5),
    );
    const close = new Button(this, PANEL_W - PAD - 18, HEADER_Y, 48, 48, '✕', {
      fill: palette.parchmentShade,
      fontSize: 24,
      icon: 'ui_close',
      badge: true,
    }).onClick(() => this.close());
    this.panel.add(close);

    const tabs: [Tab, string][] = [
      ['items', t('shop.tab.items')],
      ['hero', t('shop.tab.hero')],
      ['cat', t('shop.tab.cat')],
    ];
    tabs.forEach(([id, label], i) => {
      const b = new Button(this, PAD + 85 + i * 180, TABS_Y, 170, 46, label, {
        fontSize: 17,
      }).onClick(() => this.setTab(id));
      this.tabButtons.set(id, b);
      this.panel.add(b);
    });

    AMOUNTS.forEach((a, i) => {
      const label = a === 'max' ? t('shop.max') : `×${a}`;
      const b = new Button(
        this,
        // ×1…MAX — в строке заголовка, левее кнопки закрытия.
        PANEL_W - PAD - 88 - (AMOUNTS.length - 1 - i) * 62,
        HEADER_Y,
        60,
        46,
        label,
        {
          fontSize: 15,
        },
      ).onClick(() => this.setAmount(a));
      this.amountButtons.set(a, b);
      this.panel.add(b);
    });

    this.itemsLayer = this.add.container(0, 0);
    this.heroLayer = this.add.container(0, 0);
    this.catLayer = this.add.container(0, 0);
    this.panel.add([this.itemsLayer, this.heroLayer, this.catLayer]);

    this.session.economy.upgrades.items.forEach((item, i) => {
      const row = this.createRow(item.id, i);
      row.buy.onClick(() => this.session.buyItem(item.id, this.amount));
      this.itemsLayer.add(row.root);
      this.itemRows.push(row);
    });
    this.session.upgrades.list.forEach((u, i) => {
      const row = this.createRow(u.id, i);
      row.buy.onClick(() => this.session.buyHero(u.id));
      this.heroLayer.add(row.root);
      this.heroRows.push(row);
    });

    this.session.catUpgrades.list.forEach((u, i) => {
      const row = this.createRow(u.id, i, 'icon_sardine');
      row.buy.onClick(() => this.session.buyCat(u.id));
      this.catLayer.add(row.root);
      this.catRows.push(row);
    });
    this.catLocked = this.add
      .text(PANEL_W / 2, ROWS_Y + 40, t('cat.locked'), {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: toCss(palette.inkSoft),
        align: 'center',
        wordWrap: { width: ROW_W - 40 },
      })
      .setOrigin(0.5, 0);
    this.catLayer.add(this.catLocked);
    this.createSkinRows();

    this.setTab('items');
    this.setAmount(1);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  /** Скины кота — под прокачкой, отдельным списком. */
  private createSkinRows(): void {
    const top = ROWS_Y + this.catRows.length * (ROW_H + ROW_GAP) + 14;
    this.skinsTitle = this.add
      .text(PAD + 6, top, t('cat.skins'), {
        fontFamily: 'Georgia, serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: toCss(palette.ink),
      })
      .setOrigin(0, 0);
    this.catLayer.add(this.skinsTitle);
    this.session.catSkins.forEach((s, i) => {
      const row = this.createRow(s.id, i, undefined, top + 34);
      row.detail.setWordWrapWidth(ROW_W - BUY_W - 40 - SKIN_THUMB_W);
      row.buy.onClick(() => this.session.wearCatSkin(s.id));
      const buy = new Button(this, row.buy.x, row.buy.y, BUY_W, 44, String(s.cost), {
        fontSize: 19,
        icon: 'icon_sardine',
      }).onClick(() => this.session.buyCatSkin(s.id));
      const head = hasCatSkin(s.id) ? catSkinKey('cat_head', s.id) : 'cat_head';
      const thumb = unitImage(this, head, ROW_W - 12 - BUY_W - SKIN_THUMB_W / 2 - 6, ROW_H / 2);
      thumb.setScale(thumb.scaleX * SKIN_THUMB_SCALE);
      row.root.add([thumb, buy]);
      this.catLayer.add(row.root);
      this.skinRows.push({ ...row, wear: row.buy, buy });
    });
  }

  private createRow(id: string, index: number, icon?: string, top = ROWS_Y): Row {
    const y = top + index * (ROW_H + ROW_GAP);
    const root = this.add.container(PAD, y);
    // Пергаментная полоска с булавкой (растр) или векторная плашка.
    const strip = addStrip(this, skin.row, ROW_W / 2, ROW_H / 2, ROW_W + 14, ROW_H + 10);
    let g: Phaser.GameObjects.GameObject;
    if (strip) {
      g = strip;
    } else {
      const v = this.add.graphics();
      v.fillStyle(palette.parchmentLight, 1);
      v.fillRoundedRect(0, 0, ROW_W, ROW_H, 10);
      v.lineStyle(2, palette.outline, 0.8);
      v.strokeRoundedRect(0, 0, ROW_W, ROW_H, 10);
      g = v;
    }
    const textX = strip ? 46 : 14;
    const title = this.add.text(textX, 5, '', textStyle(18, palette.ink, true));
    const detail = this.add.text(textX, 31, '', textStyle(13, palette.inkSoft));
    detail.setWordWrapWidth(ROW_W - BUY_W - 40);
    const buy = new Button(this, ROW_W - 12 - BUY_W / 2, ROW_H / 2, BUY_W, 44, '', {
      fontSize: 19,
      ...(icon ? { icon } : {}),
    });
    root.add([g, title, detail, buy]);
    return { id, root, title, detail, buy };
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.panel.setVisible(true);
    this.tweens.killTweensOf(this.panel);
    this.tweens.add({ targets: this.panel, x: OPEN_X, duration: SLIDE_MS, ease: 'Cubic.easeOut' });
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.tweens.killTweensOf(this.panel);
    this.tweens.add({
      targets: this.panel,
      x: CLOSED_X,
      duration: SLIDE_MS,
      ease: 'Cubic.easeIn',
      onComplete: () => this.panel.setVisible(false),
    });
  }

  private setTab(tab: Tab): void {
    this.tab = tab;
    for (const [id, b] of this.tabButtons) {
      b.setFill(id === tab ? palette.lanternAmber : palette.parchmentShade);
    }
    this.itemsLayer.setVisible(tab === 'items');
    this.heroLayer.setVisible(tab === 'hero');
    this.catLayer.setVisible(tab === 'cat');
    for (const b of this.amountButtons.values()) b.setVisible(tab === 'items');
  }

  private setAmount(a: BuyAmount): void {
    this.amount = a;
    for (const [id, b] of this.amountButtons) {
      b.setFill(id === a ? palette.lanternAmber : palette.parchmentShade);
    }
  }

  override update(): void {
    if (!this.panel.visible) return;
    if (this.tab === 'items') this.updateItems();
    else if (this.tab === 'hero') this.updateHero();
    else this.updateCat();
  }

  private updateItems(): void {
    const s = this.session;
    const eco = s.economy;
    const notation = s.state.settings.notation;
    let prevOwned = true;
    for (const row of this.itemRows) {
      const level = s.itemLevel(row.id);
      // Следующие позиции открываются по одной: пока не куплена предыдущая, видно только «???».
      const known = level > 0 || prevOwned;
      prevOwned = level > 0;
      const q = s.quoteItem(row.id, this.amount);
      if (known) {
        const name = tId(`item.${row.id}`);
        setText(row.title, level > 0 ? `${name} · ${t('shop.level', { level })}` : name);
        const each = eco.itemCps(row.id, 1);
        const milestone = eco.nextMilestone(level);
        let detail = t('shop.cps', {
          each: formatNumber(each, notation),
          total: formatNumber(eco.itemCps(row.id, level), notation),
        });
        if (milestone !== null && level > 0)
          detail += ` · ${t('shop.milestone', { level: milestone })}`;
        setText(row.detail, detail);
      } else {
        setText(row.title, '???');
        setText(row.detail, '');
      }
      const prefix = q.count > 1 ? `×${q.count} · ` : '';
      row.buy.setLabel(prefix + formatNumber(q.cost, notation)).setEnabled(q.affordable);
    }
  }

  private updateHero(): void {
    const s = this.session;
    const notation = s.state.settings.notation;
    for (const row of this.heroRows) {
      const tier = s.heroTier(row.id);
      const max = s.upgrades.maxTier(row.id);
      const name = tId(`hero.${row.id}`);
      setText(row.title, max > 1 ? `${name} · ${t('shop.tier', { tier, max })}` : name);
      setText(row.detail, tId(`hero.${row.id}.desc`));
      const cost = s.heroNextCost(row.id);
      if (cost === null) {
        row.buy.setLabel(t('shop.bought')).setEnabled(false);
      } else {
        row.buy.setLabel(formatNumber(cost, notation)).setEnabled(s.state.coins.gte(cost));
      }
    }
  }

  /** Кот-фамильяр: прокачка за сардинки (SPEC §4.7); до первого Сновидения — заглушка. */
  private updateCat(): void {
    const s = this.session;
    const unlocked = s.state.cat.unlocked;
    this.catLocked.setVisible(!unlocked);
    for (const row of this.catRows) {
      row.root.setVisible(unlocked);
      if (!unlocked) continue;
      const tier = s.catTier(row.id);
      const max = s.catUpgrades.maxTier(row.id);
      setText(row.title, `${tId(`cat.${row.id}`)} · ${t('shop.tier', { tier, max })}`);
      setText(row.detail, tId(`cat.${row.id}.desc`));
      const cost = s.catNextCost(row.id);
      if (cost === null) row.buy.setLabel(t('shop.bought')).setEnabled(false);
      else row.buy.setLabel(String(cost)).setEnabled(s.state.sardines >= cost);
    }
    this.skinsTitle.setVisible(unlocked);
    const worn = s.catSkin;
    for (const row of this.skinRows) {
      row.root.setVisible(unlocked);
      if (!unlocked) continue;
      setText(row.title, tId(`catSkin.${row.id}`));
      setText(row.detail, tId(`catSkin.${row.id}.desc`));
      const owned = s.ownsCatSkin(row.id);
      const cost = s.catSkins.find((k) => k.id === row.id)?.cost ?? 0;
      row.buy.setVisible(!owned).setEnabled(s.state.sardines >= cost);
      row.wear
        .setVisible(owned)
        .setLabel(row.id === worn ? t('cat.skin.worn') : t('cat.skin.wear'))
        .setEnabled(row.id !== worn);
    }
  }
}

function setText(obj: Phaser.GameObjects.Text, text: string): void {
  if (obj.text !== text) obj.setText(text);
}
