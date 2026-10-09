import Phaser from 'phaser';
import { app } from '../app';
import display from '../config/display.json';
import type { BuildingConfig } from '../config';
import { formatNumber } from '../core/BigNum';
import { t, tId } from '../i18n';
import { palette, toCss } from '../render/palette';
import { isRaster, unitImage, unitScale } from '../render/textures';
import { addPanel, addStrip, Button } from '../render/ui/Button';
import skin from '../render/ui/skin.json';
import { describeEffect, scaleEffect } from '../render/ui/effects';
import type { GameSession } from '../systems/GameSession';

const SLIDE_MS = 220;
/** Лента под заголовком: левый край и поле до текста (хвосты ленты). */
const RIBBON_X = 12;
const RIBBON_PAD = 66;
const INFO_W = 920;
const INFO_H = 170;
const INFO_X = (display.width - INFO_W) / 2;
const INFO_Y = display.height - INFO_H - 14;

/** Где стоит каждая постройка на утёсе (центр основания). */
const PLOTS: Readonly<Record<string, { x: number; y: number }>> = {
  lighthouse: { x: 1158, y: 236 },
  observatory: { x: 130, y: 330 },
  greenhouse: { x: 320, y: 404 },
  chapel: { x: 520, y: 372 },
  archive: { x: 712, y: 424 },
  fishMarket: { x: 236, y: 498 },
};

interface Slot {
  cfg: BuildingConfig;
  building: Phaser.GameObjects.Image;
  plot: Phaser.GameObjects.Image;
  lights: Phaser.GameObjects.Image;
  level: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
}

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

/**
 * Городок на утёсе (SPEC §6): шесть построек за дублоны, каждая даёт глобальный бонус.
 * Свет маяка рассеивает туман над городом — видно, как город растёт и светлеет.
 * Забег за городком не останавливается, как и в лавке.
 */
export class TownScene extends Phaser.Scene {
  private session!: GameSession;
  private root!: Phaser.GameObjects.Container;
  private slots: Slot[] = [];
  private fog: Phaser.GameObjects.TileSprite[] = [];
  private beam!: Phaser.GameObjects.Graphics;
  private coinsText!: Phaser.GameObjects.Text;
  private infoTitle!: Phaser.GameObjects.Text;
  private infoLevel!: Phaser.GameObjects.Text;
  private infoDesc!: Phaser.GameObjects.Text;
  private infoEffects!: Phaser.GameObjects.Text;
  private buyButton!: Button;
  private selected: BuildingConfig | null = null;
  private isOpen = false;

  constructor() {
    super('TownScene');
  }

  get opened(): boolean {
    return this.isOpen;
  }

  create(): void {
    this.session = app().session;
    this.slots = [];
    this.fog = [];
    this.isOpen = false;
    this.selected = null;

    this.root = this.add.container(0, display.height + 40).setVisible(false);
    const bg = this.add.image(0, 0, 'town_bg').setOrigin(0).setInteractive();
    bg.setDisplaySize(display.width, display.height);
    this.root.add(bg);

    this.beam = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.root.add(this.beam);

    for (const cfg of this.session.town.list) {
      const pos = PLOTS[cfg.id];
      if (!pos) continue;
      const lights = unitImage(this, 'glow', pos.x, pos.y - 50)
        .setTint(palette.lanternAmber)
        .setBlendMode(Phaser.BlendModes.ADD);
      const plot = unitImage(this, 'town_plot', pos.x, pos.y).setOrigin(0.5, 1);
      const building = unitImage(this, `town_${cfg.id}`, pos.x, pos.y).setOrigin(0.5, 1);
      const level = this.add
        .text(pos.x, pos.y + 16, '', {
          ...text(15, palette.parchment, true),
          stroke: toCss(palette.outline),
          strokeThickness: 4,
        })
        .setOrigin(0.5);
      const zone = this.add
        .zone(
          pos.x,
          pos.y - building.displayHeight / 2,
          Math.max(110, building.displayWidth),
          building.displayHeight + 30,
        )
        .setInteractive({ useHandCursor: true });
      zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => this.select(cfg));
      this.root.add([lights, plot, building, level, zone]);
      this.slots.push({ cfg, building, plot, lights, level, zone });
    }

    // Туман над городом: тает с уровнем маяка.
    for (const [y, a] of [
      [330, 1],
      [430, 0.8],
    ] as const) {
      const fog = this.add
        .tileSprite(0, y, display.width, 240, 'fog_coast')
        .setOrigin(0)
        .setTileScale(unitScale('fog_coast'), unitScale('fog_coast'))
        .setAlpha(a);
      fog.setData('base', a);
      this.fog.push(fog);
      this.root.add(fog);
    }

    // Верхняя полоса: название, кошелёк, закрыть.
    const title = this.add
      .text(40, 40, t('town.title'), {
        fontFamily: 'Georgia, serif',
        fontSize: '34px',
        fontStyle: 'bold',
        color: toCss(palette.parchment),
        stroke: toCss(palette.outline),
        strokeThickness: 6,
      })
      .setOrigin(0, 0.5);
    if (isRaster(skin.ribbon.key)) {
      title
        .setColor(toCss(palette.parchmentLight))
        .setFontSize(30)
        .setX(RIBBON_X + RIBBON_PAD);
      const w = title.width + RIBBON_PAD * 2;
      const ribbon = addStrip(this, skin.ribbon, RIBBON_X + w / 2, 42, w, 70);
      if (ribbon) this.root.add(ribbon);
    }
    this.coinsText = this.add
      .text(40, 92, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        color: toCss(palette.lanternAmber),
        stroke: toCss(palette.outline),
        strokeThickness: 5,
      })
      .setOrigin(0, 0.5);
    const keep = this.add
      .text(display.width / 2, 40, t('town.keep'), {
        ...text(16, palette.fog),
        stroke: toCss(palette.outline),
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    const close = new Button(this, display.width - 50, 44, 48, 48, '✕', {
      fill: palette.parchmentShade,
      fontSize: 24,
      icon: 'ui_close',
      badge: true,
    }).onClick(() => this.close());
    this.root.add([title, this.coinsText, keep, close]);

    // Карточка выбранной постройки.
    const info = addPanel(this, INFO_X, INFO_Y, INFO_W, INFO_H);
    this.infoTitle = this.add
      .text(INFO_X + 44, INFO_Y + 46, '', {
        fontFamily: 'Georgia, serif',
        fontSize: '24px',
        fontStyle: 'bold',
        color: toCss(palette.ink),
      })
      .setOrigin(0, 0.5);
    this.infoLevel = this.add
      .text(INFO_X + INFO_W - 300, INFO_Y + 46, '', text(17, palette.inkSoft, true))
      .setOrigin(1, 0.5);
    this.infoDesc = this.add
      .text(INFO_X + 44, INFO_Y + 80, '', text(17, palette.inkSoft))
      .setOrigin(0, 0.5);
    this.infoEffects = this.add
      .text(INFO_X + 44, INFO_Y + 116, '', text(15, palette.ink))
      .setOrigin(0, 0.5)
      .setWordWrapWidth(INFO_W - 360);
    this.buyButton = new Button(this, INFO_X + INFO_W - 150, INFO_Y + INFO_H / 2 + 4, 240, 70, '', {
      fontSize: 17,
    }).onClick(() => {
      if (this.selected && this.session.buyBuilding(this.selected.id)) this.refresh();
    });
    this.root.add([
      info,
      this.infoTitle,
      this.infoLevel,
      this.infoDesc,
      this.infoEffects,
      this.buyButton,
    ]);

    this.input.keyboard?.on('keydown-ESC', () => this.close());
    this.select(this.session.town.list[0]!);
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

  private select(cfg: BuildingConfig): void {
    this.selected = cfg;
    this.refresh();
  }

  private refresh(): void {
    const s = this.session;
    const notation = s.state.settings.notation;
    this.coinsText.setText(`⛀ ${formatNumber(s.state.coins.floor(), notation)}`);
    for (const slot of this.slots) {
      const lvl = s.buildingLevel(slot.cfg.id);
      const built = lvl > 0;
      slot.plot.setVisible(!built);
      // Непостроенное здание — бледный «чертёж» над участком.
      slot.building
        .setAlpha(built ? 1 : 0.22)
        .setScale(unitScale(`town_${slot.cfg.id}`) * (built ? 1 + 0.025 * lvl : 0.9));
      slot.lights.setAlpha(built ? 0.08 + 0.06 * lvl : 0);
      slot.level.setText(built ? t('town.level', { level: lvl, max: slot.cfg.maxLevel }) : '');
      slot.building.setTint(this.selected === slot.cfg ? 0xffffff : built ? 0xe8e0f0 : 0xb8b0c8);
    }
    const cleared = s.town.fogCleared(s.state.town);
    for (const f of this.fog) f.setAlpha((f.getData('base') as number) * 0.85 * (1 - cleared));

    const cfg = this.selected;
    if (!cfg) return;
    const lvl = s.buildingLevel(cfg.id);
    this.infoTitle.setText(tId(`town.${cfg.id}`));
    this.infoLevel.setText(t('town.level', { level: lvl, max: cfg.maxLevel }));
    this.infoDesc.setText(tId(`town.${cfg.id}.desc`));
    const per = t('town.next', { effects: describeEffect(cfg) });
    const now =
      lvl > 0 ? `\n${t('town.total', { effects: describeEffect(scaleEffect(cfg, lvl)) })}` : '';
    this.infoEffects.setText(per + now);
    const cost = s.buildingCost(cfg.id);
    if (!cost) {
      this.buyButton.setLabel(t('town.max')).setEnabled(false);
      return;
    }
    const verb = lvl === 0 ? t('town.build') : t('town.upgrade');
    this.buyButton
      .setLabel(`${verb}\n${formatNumber(cost, notation)}`)
      .setEnabled(s.state.coins.gte(cost));
  }

  override update(time: number, deltaMs: number): void {
    if (!this.isOpen) return;
    for (const [i, f] of this.fog.entries()) f.tilePositionX += (deltaMs / 1000) * (10 + i * 8);
    // Луч маяка: шире и ярче с уровнем.
    const lvl = this.session.buildingLevel('lighthouse');
    this.beam.clear();
    if (lvl > 0) {
      const pos = PLOTS.lighthouse!;
      const tower = this.slots.find((sl) => sl.cfg.id === 'lighthouse')?.building;
      const lx = pos.x;
      // Лампа — у верхушки башни.
      const ly = pos.y - (tower?.displayHeight ?? 240) * 0.86;
      const sweep = Math.sin(time / 1400) * 0.35;
      const len = 420 + lvl * 30;
      const spread = 0.12 + lvl * 0.012;
      this.beam.fillStyle(palette.lanternAmber, 0.08 + lvl * 0.012);
      this.beam.beginPath();
      this.beam.moveTo(lx, ly);
      this.beam.lineTo(lx - Math.cos(sweep - spread) * len, ly + Math.sin(sweep - spread) * len);
      this.beam.lineTo(lx - Math.cos(sweep + spread) * len, ly + Math.sin(sweep + spread) * len);
      this.beam.closePath();
      this.beam.fillPath();
    }
    // Кошелёк растёт и при открытом городке — кнопка «Построить» оживает.
    if (Math.floor(time / 250) !== Math.floor((time - deltaMs) / 250)) this.refresh();
  }
}
