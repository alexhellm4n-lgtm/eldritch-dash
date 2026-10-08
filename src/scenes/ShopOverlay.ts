import Phaser from 'phaser';
import { app } from '../app';
import display from '../config/display.json';
import { formatNumber } from '../core/BigNum';
import { t, tId } from '../i18n';
import { palette, toCss } from '../render/palette';
import { Button, drawPanel } from '../render/ui/Button';
import type { BuyAmount } from '../systems/Economy';
import type { GameSession } from '../systems/GameSession';

const PANEL_W = 640;
const PANEL_H = display.height - 24;
const OPEN_X = display.width - PANEL_W - 12;
const CLOSED_X = display.width + 24;
const PAD = 24;
const ROW_W = PANEL_W - PAD * 2;
const ROW_H = 64;
const ROW_GAP = 4;
const ROWS_Y = 130;
const BUY_W = 176;
const SLIDE_MS = 220;
const AMOUNTS: readonly BuyAmount[] = [1, 10, 100, 'max'];

type Tab = 'items' | 'hero';

interface Row {
  id: string;
  root: Phaser.GameObjects.Container;
  title: Phaser.GameObjects.Text;
  detail: Phaser.GameObjects.Text;
  buy: Button;
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
    this.tabButtons.clear();
    this.amountButtons.clear();
    this.isOpen = false;

    this.panel = this.add.container(CLOSED_X, 12).setVisible(false);
    const bg = this.add.graphics();
    drawPanel(bg, 0, 0, PANEL_W, PANEL_H);
    // Фон панели перехватывает клики, чтобы они не превращались в прыжки.
    const blocker = this.add.zone(0, 0, PANEL_W, PANEL_H).setOrigin(0).setInteractive();
    this.panel.add([bg, blocker]);

    this.panel.add(
      this.add
        .text(PAD, 34, t('shop.title'), {
          fontFamily: 'Georgia, serif',
          fontSize: '30px',
          fontStyle: 'bold',
          color: toCss(palette.ink),
        })
        .setOrigin(0, 0.5),
    );
    const close = new Button(this, PANEL_W - 40, 34, 48, 48, '✕', {
      fill: palette.parchmentShade,
      fontSize: 24,
    }).onClick(() => this.close());
    this.panel.add(close);

    const tabs: [Tab, string][] = [
      ['items', t('shop.tab.items')],
      ['hero', t('shop.tab.hero')],
    ];
    tabs.forEach(([id, label], i) => {
      const b = new Button(this, PAD + 80 + i * 168, 92, 160, 46, label, { fontSize: 19 }).onClick(
        () => this.setTab(id),
      );
      this.tabButtons.set(id, b);
      this.panel.add(b);
    });

    AMOUNTS.forEach((a, i) => {
      const label = a === 'max' ? t('shop.max') : `×${a}`;
      const b = new Button(
        this,
        PANEL_W - PAD - 30 - (AMOUNTS.length - 1 - i) * 66,
        92,
        60,
        46,
        label,
        {
          fontSize: 18,
        },
      ).onClick(() => this.setAmount(a));
      this.amountButtons.set(a, b);
      this.panel.add(b);
    });

    this.itemsLayer = this.add.container(0, 0);
    this.heroLayer = this.add.container(0, 0);
    this.panel.add([this.itemsLayer, this.heroLayer]);

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

    this.setTab('items');
    this.setAmount(1);
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private createRow(id: string, index: number): Row {
    const y = ROWS_Y + index * (ROW_H + ROW_GAP);
    const root = this.add.container(PAD, y);
    const g = this.add.graphics();
    g.fillStyle(palette.parchmentLight, 1);
    g.fillRoundedRect(0, 0, ROW_W, ROW_H, 10);
    g.lineStyle(2, palette.outline, 0.8);
    g.strokeRoundedRect(0, 0, ROW_W, ROW_H, 10);
    const title = this.add.text(14, 8, '', textStyle(20, palette.ink, true));
    const detail = this.add.text(14, 37, '', textStyle(14, palette.inkSoft));
    detail.setWordWrapWidth(ROW_W - BUY_W - 40);
    const buy = new Button(this, ROW_W - 12 - BUY_W / 2, ROW_H / 2, BUY_W, 48, '', {
      fontSize: 19,
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
    else this.updateHero();
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
}

function setText(obj: Phaser.GameObjects.Text, text: string): void {
  if (obj.text !== text) obj.setText(text);
}
