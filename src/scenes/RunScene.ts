import Phaser from 'phaser';
import { app } from '../app';
import { biomesConfig, juiceConfig, runConfig } from '../config';
import { formatNumber } from '../core/BigNum';
import { t } from '../i18n';
import { createEntityView, viewKey, type EntityView } from '../render/EntityViews';
import { HeroView } from '../render/HeroView';
import { Juice } from '../render/Juice';
import { LanternFx } from '../render/LanternFx';
import { Depth, Parallax } from '../render/Parallax';
import { Particles } from '../render/Particles';
import { palette } from '../render/palette';
import type { Entity } from '../systems/Entity';
import { RunSim } from '../systems/RunSim';

const BIOME = 'coast';

const DEPTH_BY_KIND = { coin: Depth.coin, obstacle: Depth.obstacle, enemy: Depth.enemy } as const;

/** Сцена забега: прокидывает ввод в RunSim и рисует его состояние. Игровой логики здесь нет. */
export class RunScene extends Phaser.Scene {
  sim!: RunSim;
  private heroView!: HeroView;
  private parallax!: Parallax;
  private particles!: Particles;
  private juice!: Juice;
  private lanternFx!: LanternFx;
  private readonly views = new Map<Entity, EntityView>();
  private readonly pools = new Map<string, EntityView[]>();

  constructor() {
    super('RunScene');
  }

  create(): void {
    this.views.clear();
    this.pools.clear();
    this.sim = new RunSim({ seed: Math.floor(Math.random() * 2 ** 31), biome: BIOME });
    const session = app().session;
    session.attachRun(this.sim);
    this.parallax = new Parallax(this, BIOME, biomesConfig[BIOME]!, runConfig.world.groundY);
    this.heroView = new HeroView(this);
    this.heroView.container.setDepth(Depth.hero);
    this.particles = new Particles(this);
    this.juice = new Juice(this);
    this.lanternFx = new LanternFx(this);

    this.bindInput();
    this.bindEvents();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      session.detachRun();
      this.sim.bus.clear();
    });

    this.scene.launch('UIScene', { sim: this.sim });
  }

  private bindInput(): void {
    const press = (): void => this.sim.press();
    const release = (): void => this.sim.release();
    this.input.on(Phaser.Input.Events.POINTER_DOWN, press);
    this.input.on(Phaser.Input.Events.POINTER_UP, release);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, release);
    // Потеря фокуса с зажатой кнопкой не должна оставлять «залипшее» парение.
    this.game.events.on(Phaser.Core.Events.BLUR, release);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.game.events.off(Phaser.Core.Events.BLUR, release),
    );
    const kb = this.input.keyboard;
    if (!kb) return;
    for (const key of ['SPACE', 'UP', 'W']) {
      kb.on(`keydown-${key}`, (ev: KeyboardEvent) => {
        if (!ev.repeat) press();
      });
      kb.on(`keyup-${key}`, release);
    }
    kb.addCapture('SPACE,UP');
  }

  private bindEvents(): void {
    const bus = this.sim.bus;
    const heroCfg = runConfig.hero;
    const sim = (): RunSim => this.sim;

    bus.on('spawn', (e) => this.acquireView(e));
    bus.on('despawn', (e) => this.releaseView(e));

    bus.on('coin', (e) => {
      this.particles.coinBurst(e.x, e.y);
      this.juice.popup(e.x, e.y - 18, `+${formatNumber(e.reward)}`, palette.lanternAmber, 20);
    });
    bus.on('kill', (e) => {
      this.particles.splat(e.x, e.y);
      this.particles.coinBurst(e.x, e.y);
      this.juice.popup(
        e.x,
        e.y - e.h / 2 - 10,
        `+${formatNumber(e.reward)}`,
        palette.lanternAmber,
        30,
      );
      this.juice.shake(juiceConfig.shake.kill);
      this.juice.hitStop();
    });
    bus.on('hurt', (e) => {
      this.particles.splat(e.x, e.y);
      this.juice.shake(juiceConfig.shake.armorHit);
    });
    bus.on('flash', (target) => {
      this.heroView.onFlash();
      const from = this.heroView.lanternWorld();
      this.lanternFx.fire(from.x, from.y, target.x, target.y);
    });
    bus.on('jump', () => {
      this.heroView.onJump();
      this.particles.dustPuff(sim().hero.x, sim().hero.y);
    });
    bus.on('land', () => {
      this.heroView.onLand();
      this.particles.dustPuff(sim().hero.x, sim().hero.y);
    });
    bus.on('stun', () => {
      const h = sim().hero;
      this.juice.shake(juiceConfig.shake.stun);
      this.juice.popup(h.x, h.y - heroCfg.height - 40, t('popup.stun'), palette.coral, 28);
    });
    bus.on('cleared', (e) => {
      this.juice.popup(e.x, e.y - e.h / 2 - 20, t('popup.cleared'), palette.bioCyan, 22);
    });
    bus.on('comboBroken', () => {
      const h = sim().hero;
      this.juice.popup(h.x, h.y - heroCfg.height - 80, t('popup.comboBroken'), palette.fog, 20);
    });
    bus.on('rebase', (dx) => {
      this.particles.shift(dx);
      this.lanternFx.shift(dx);
      this.juice.shift(dx);
    });
  }

  private acquireView(e: Entity): void {
    const key = viewKey(e);
    const pool = this.pools.get(key);
    const view = pool?.pop() ?? createEntityView(this, e);
    view.root.setDepth(DEPTH_BY_KIND[e.kind]);
    view.bind(e);
    this.views.set(e, view);
  }

  private releaseView(e: Entity): void {
    const view = this.views.get(e);
    if (!view) return;
    this.views.delete(e);
    view.root.setVisible(false);
    const key = viewKey(e);
    let pool = this.pools.get(key);
    if (!pool) this.pools.set(key, (pool = []));
    pool.push(view);
  }

  override update(_time: number, deltaMs: number): void {
    this.juice.update(deltaMs);
    const frozen = this.juice.hitStopLeft > 0;
    const dt = frozen ? 0 : deltaMs / 1000;
    if (!frozen) this.sim.update(dt);
    // Пассивный доход идёт и во время hit-stop.
    app().session.tick(deltaMs / 1000);

    const sim = this.sim;
    const hero = sim.hero;
    this.cameras.main.scrollX = hero.x - runConfig.hero.screenX;
    this.parallax.update(sim.distancePx, dt);
    this.heroView.update(hero, hero.x, dt);
    const lantern = this.heroView.lanternWorld();
    this.lanternFx.update(dt, lantern.x, lantern.y);

    const heroCy = hero.y - runConfig.hero.height / 2;
    for (const e of sim.entities) this.views.get(e)?.update(e, sim.time, hero.x, heroCy);
  }
}
