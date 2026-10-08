import Phaser from 'phaser';
import { app } from '../app';
import display from '../config/display.json';
import { dreamConfig } from '../config';
import { formatNumber } from '../core/BigNum';
import { t } from '../i18n';
import { HeroView } from '../render/HeroView';
import { palette, toCss } from '../render/palette';
import { unitImage, unitScale } from '../render/textures';
import { addPanel, Button } from '../render/ui/Button';
import { DreamSim, type DreamObj } from '../systems/Dream';
import type { DreamReward } from '../systems/GameSession';
import type { RunScene } from './RunScene';

const HERO_SCREEN_X = 300;
const BAR_W = 380;
const BAR_H = 22;
const BAR_Y = display.height - 46;
/** Небо сна: ночное небо побережья, перекрашенное в фиолетовые тона. */
const DREAM_SKY_TINT = 0xc8a0ff;
const SKY_SCROLL = 0.08;

const KEY_BY_KIND: Record<DreamObj['kind'], string> = {
  coin: 'coin',
  ring: 'dream_ring',
  island: 'dream_island',
};

interface DreamData {
  seed: number;
  /** Это уже второй («рекламный») сон — повтор больше не предлагаем. */
  bonus?: boolean;
}

/** «Сновидение» (SPEC §4.6): отдельная сцена полёта; забег стоит на паузе. */
export class DreamScene extends Phaser.Scene {
  private sim!: DreamSim;
  private heroView!: HeroView;
  private sky!: Phaser.GameObjects.TileSprite;
  private readonly objViews = new Map<DreamObj, Phaser.GameObjects.Image>();
  private bar!: Phaser.GameObjects.Graphics;
  private needle!: Phaser.GameObjects.Rectangle;
  private timerText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private greenFlash = 0;
  private bonus = false;
  private resultShown = false;

  constructor() {
    super('DreamScene');
  }

  init(data: DreamData): void {
    this.bonus = data.bonus === true;
    this.resultShown = false;
    this.objViews.clear();
    this.sim = new DreamSim(dreamConfig, data.seed);
  }

  create(): void {
    this.sky = this.add
      .tileSprite(0, 0, display.width, display.height, 'bg_coast_layer0')
      .setOrigin(0)
      .setScrollFactor(0)
      .setTint(DREAM_SKY_TINT);
    this.sky.setTileScale(unitScale('bg_coast_layer0'), unitScale('bg_coast_layer0'));

    this.heroView = new HeroView(this);
    this.heroView.container.setDepth(10);

    const ui = { fontFamily: 'Georgia, serif', stroke: toCss(palette.outline), strokeThickness: 6 };
    this.timerText = this.add
      .text(display.width / 2, 36, '', { ...ui, fontSize: '30px', color: toCss(palette.parchment) })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20);
    this.scoreText = this.add
      .text(display.width / 2, 74, '', { ...ui, fontSize: '22px', color: toCss(palette.bioCyan) })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20);
    this.hintText = this.add
      .text(display.width / 2, display.height - 96, t('dream.hint'), {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: toCss(palette.parchment),
        stroke: toCss(palette.outline),
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20);

    this.bar = this.add.graphics().setScrollFactor(0).setDepth(20);
    this.drawBar();
    this.needle = this.add
      .rectangle(0, BAR_Y, 6, BAR_H + 14, palette.parchment)
      .setStrokeStyle(2, palette.outline)
      .setScrollFactor(0)
      .setDepth(21);

    const tap = (): void => this.sim.tap();
    this.input.on(Phaser.Input.Events.POINTER_DOWN, tap);
    this.input.keyboard?.on('keydown-SPACE', (ev: KeyboardEvent) => {
      if (!ev.repeat) tap();
    });

    this.sim.bus.on('tap', (perfect) => {
      this.heroView.onJump();
      if (perfect) this.greenFlash = 1;
    });
    this.sim.bus.on('end', () => this.showResult());
  }

  private drawBar(): void {
    const g = this.bar;
    const x0 = display.width / 2 - BAR_W / 2;
    const r = dreamConfig.rhythm;
    g.clear();
    g.fillStyle(palette.outline, 0.85);
    g.fillRoundedRect(x0 - 4, BAR_Y - BAR_H / 2 - 4, BAR_W + 8, BAR_H + 8, 10);
    g.fillStyle(palette.violetShadeUi, 1);
    g.fillRoundedRect(x0, BAR_Y - BAR_H / 2, BAR_W, BAR_H, 8);
    g.fillStyle(palette.seaGreen, 1);
    g.fillRect(
      x0 + BAR_W * r.greenFrom,
      BAR_Y - BAR_H / 2,
      BAR_W * (r.greenTo - r.greenFrom),
      BAR_H,
    );
  }

  override update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const sim = this.sim;
    sim.update(dt);

    this.cameras.main.scrollX = sim.x - HERO_SCREEN_X;
    this.sky.tilePositionX = sim.x * SKY_SCROLL;
    this.heroView.update(sim, sim.x, dt);
    this.syncObjects(sim.time);

    this.timerText.setText(t('dream.left', { time: Math.ceil(sim.timeLeft) }));
    this.scoreText.setText(
      `${t('dream.rings', { n: sim.rings })}   ${t('dream.coins', { n: sim.coins })}`,
    );
    this.hintText.setAlpha(Math.max(0, 1 - sim.time / 5));
    const x0 = display.width / 2 - BAR_W / 2;
    this.needle.setX(x0 + BAR_W * sim.rhythm);
    this.greenFlash = Math.max(0, this.greenFlash - dt * 4);
    this.needle.setFillStyle(this.greenFlash > 0 ? palette.bioCyan : palette.parchment);
  }

  private syncObjects(time: number): void {
    const alive = new Set<DreamObj>();
    for (const o of this.sim.objects) {
      alive.add(o);
      let img = this.objViews.get(o);
      if (!img) {
        img = unitImage(this, KEY_BY_KIND[o.kind]).setDepth(o.kind === 'island' ? 1 : 5);
        this.objViews.set(o, img);
      }
      const bob = Math.sin(time * 2 + o.x * 0.01) * (o.kind === 'island' ? 10 : 4);
      img.setPosition(o.x, o.y + bob);
      if (o.taken) {
        // Взятое: кольцо вспыхивает и гаснет, монета улетает вверх.
        o.t += this.game.loop.delta / 1000;
        img.setAlpha(Math.max(0, 1 - o.t * 3));
        if (o.kind === 'coin') img.y -= o.t * 120;
      }
    }
    for (const [o, img] of this.objViews) {
      if (alive.has(o)) continue;
      img.destroy();
      this.objViews.delete(o);
    }
  }

  private showResult(): void {
    if (this.resultShown) return;
    this.resultShown = true;
    const session = app().session;
    const reward: DreamReward = session.dreamReward(this.sim.points, this.sim.rings);
    const W = 600;
    const H = 320;
    const cx = display.width / 2;
    const cy = display.height / 2;
    const modal = this.add.container(0, 0).setDepth(50);
    const shade = this.add
      .rectangle(0, 0, display.width, display.height, palette.nightSky, 0.55)
      .setOrigin(0)
      .setInteractive();
    const panel = addPanel(this, cx - W / 2, cy - H / 2, W, H);
    const ink = toCss(palette.ink);
    const title = this.add
      .text(cx, cy - 92, t('dream.result'), {
        fontFamily: 'Georgia, serif',
        fontSize: '32px',
        fontStyle: 'bold',
        color: ink,
      })
      .setOrigin(0.5);
    const notation = session.state.settings.notation;
    const amount = this.add
      .text(
        cx,
        cy - 26,
        t('dream.reward', {
          coins: formatNumber(reward.coins, notation),
          sardines: reward.sardines,
        }),
        {
          fontFamily: 'sans-serif',
          fontSize: '24px',
          fontStyle: 'bold',
          color: ink,
          align: 'center',
          wordWrap: { width: W - 120 },
        },
      )
      .setOrigin(0.5);
    const wake = new Button(this, cx - (this.bonus ? 0 : 140), cy + 80, 240, 60, t('dream.wake'), {
      fill: this.bonus ? palette.lanternAmber : palette.parchmentShade,
    }).onClick(() => this.finish(reward, false));
    modal.add([shade, panel, title, amount, wake]);
    if (!this.bonus) {
      const again = new Button(this, cx + 140, cy + 80, 240, 60, t('dream.again'), {
        fontSize: 15,
      });
      again.onClick(() => {
        again.setEnabled(false);
        wake.setEnabled(false);
        void app()
          .platform.showRewarded('dream_again')
          .catch(() => false)
          .then((ok) => {
            again.setEnabled(true);
            wake.setEnabled(true);
            if (ok) this.finish(reward, true);
          });
      });
      modal.add(again);
    }
    // Камера сна едет за героем: scrollFactor нужен и детям, иначе их зоны клика уезжают вместе с камерой.
    modal.setScrollFactor(0, 0, true);
  }

  /** Зачислить награду; либо проснуться, либо (после рекламы) уснуть ещё раз. */
  private finish(reward: DreamReward, again: boolean): void {
    app().session.claimDream(reward);
    if (again) {
      this.scene.restart({ seed: Math.floor(Math.random() * 2 ** 31), bonus: true });
      return;
    }
    this.scene.stop();
    (this.scene.get('RunScene') as RunScene).wakeUp();
  }
}
