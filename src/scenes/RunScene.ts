import Phaser from 'phaser';
import { app } from '../app';
import { biomesConfig, dreamConfig, juiceConfig, runConfig } from '../config';
import { formatNumber } from '../core/BigNum';
import { t, tId } from '../i18n';
import { createEntityView, viewKey, type EntityView } from '../render/EntityViews';
import { CatView } from '../render/CatView';
import { HeroView } from '../render/HeroView';
import { Juice } from '../render/Juice';
import { LanternFx } from '../render/LanternFx';
import { AwakeningFx, Distortion } from '../render/MetaFx';
import { Depth, Parallax } from '../render/Parallax';
import { Particles } from '../render/Particles';
import { unitImage, unitScale } from '../render/textures';
import { palette } from '../render/palette';
import type { Entity } from '../systems/Entity';
import { RunSim } from '../systems/RunSim';

/** Как часто сверять небесную фазу с часами, с. */
const PHASE_CHECK_SEC = 0.5;
/** Пауза между «страницы сложились» и началом сна, мс. */
const DREAM_DELAY_MS = 900;
/** Смена фона при переходе в новый биом, мс. */
const BIOME_FADE_MS = 1600;

const DEPTH_BY_KIND = {
  coin: Depth.coin,
  obstacle: Depth.obstacle,
  enemy: Depth.enemy,
  pickup: Depth.coin,
} as const;

/** Сцена забега: прокидывает ввод в RunSim и рисует его состояние. Игровой логики здесь нет. */
export class RunScene extends Phaser.Scene {
  sim!: RunSim;
  private heroView!: HeroView;
  private parallax!: Parallax;
  private particles!: Particles;
  private juice!: Juice;
  private lanternFx!: LanternFx;
  catView!: CatView;
  private awakeningFx!: AwakeningFx;
  private distortion!: Distortion;
  private phaseTimer = 0;
  private elapsed = 0;
  private dreamPending = false;
  private fadingParallax: Parallax | null = null;
  private fadeTween: Phaser.Tweens.Tween | null = null;
  /** Отладка: ускорение забега (админ-панель). */
  debugTimeScale = 1;
  private readonly views = new Map<Entity, EntityView>();
  private readonly pools = new Map<string, EntityView[]>();

  constructor() {
    super('RunScene');
  }

  create(): void {
    this.views.clear();
    this.pools.clear();
    // Сцена перезапускается при Погружении: поля экземпляра живут дальше.
    this.fadingParallax = null;
    this.fadeTween = null;
    const session = app().session;
    const world = session.state.world;
    // Сохранение могло остаться от биома, которого больше нет в конфиге.
    const biome = biomesConfig[world.biome] ? world.biome : 'coast';
    this.sim = new RunSim({
      seed: Math.floor(Math.random() * 2 ** 31),
      biome,
      progressM: biome === world.biome ? world.progressM : 0,
      lap: world.lap,
    });
    session.attachRun(this.sim);
    this.parallax = this.makeParallax(biome);
    this.heroView = new HeroView(this);
    this.heroView.container.setDepth(Depth.hero);
    this.particles = new Particles(this);
    this.juice = new Juice(this);
    this.lanternFx = new LanternFx(this);
    this.catView = new CatView(this);
    this.catView.setVisible(session.state.cat.unlocked);
    this.catView.setSkin(session.catSkin);
    this.awakeningFx = new AwakeningFx(this, runConfig.world.groundY);
    this.distortion = new Distortion(this.cameras.main);
    session.updatePhase(Date.now());
    const offSession = [
      session.bus.on('catUnlocked', () => {
        this.catView.setVisible(true);
        const h = this.sim.hero;
        this.juice.popup(h.x, h.y - 200, t('popup.catUnlocked'), palette.bioCyan, 28);
      }),
      session.bus.on('catSkin', (skin) => this.catView.setSkin(skin)),
      session.bus.on('phase', (p) => {
        const h = this.sim.hero;
        this.juice.popup(
          h.x + 300,
          260,
          t('popup.phase', { name: tId(`phase.${p.id}`) }),
          palette.parchment,
          30,
        );
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offSession.forEach((off) => off()));

    this.bindInput();
    this.bindEvents();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      session.detachRun();
      this.sim.bus.clear();
    });

    this.scene.launch('UIScene', { sim: this.sim });
  }

  private makeParallax(biome: string): Parallax {
    return new Parallax(this, biome, biomesConfig[biome]!, runConfig.world.groundY);
  }

  /** Новый биом: фон плавно сменяется, старый удаляется. */
  private crossfadeBiome(biome: string): void {
    // Предыдущая смена ещё идёт — завершаем её сразу.
    this.fadeTween?.stop();
    this.fadingParallax?.destroy();
    this.parallax.setFade(1);
    const old = this.parallax;
    const next = this.makeParallax(biome);
    next.setFade(0);
    next.update(this.sim.distancePx, 0);
    this.parallax = next;
    this.fadingParallax = old;
    const fade = { k: 0 };
    this.fadeTween = this.tweens.add({
      targets: fade,
      k: 1,
      duration: BIOME_FADE_MS,
      onUpdate: () => {
        next.setFade(fade.k);
        old.setFade(1 - fade.k);
      },
      onComplete: () => {
        old.destroy();
        this.fadingParallax = null;
        this.fadeTween = null;
      },
    });
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
      this.catView.shift(dx);
    });

    bus.on('pickup', (e) => {
      this.particles.coinBurst(e.x, e.y);
      if (e.type !== 'page') {
        this.juice.popup(e.x, e.y - 30, t('popup.sanity'), palette.bioCyan, 22);
      }
    });
    bus.on('page', (n) => {
      const h = sim().hero;
      this.juice.popup(
        h.x,
        h.y - heroCfg.height - 60,
        t('popup.page', { n, total: dreamConfig.pagesNeeded }),
        palette.parchment,
        26,
      );
    });
    bus.on('dreamReady', () => {
      const h = sim().hero;
      this.juice.popup(h.x + 120, h.y - 220, t('popup.dream'), palette.sicklyViolet, 32);
      this.startDreamSoon();
    });
    bus.on('vanish', (e) => {
      this.particles.splat(e.x, e.y);
      this.juice.popup(e.x, e.y - e.h / 2 - 10, t('popup.illusion'), palette.sicklyViolet, 22);
    });
    bus.on('chest', (c) => {
      this.popChest(c.x, c.y);
      this.particles.coinBurst(c.x, c.y);
      this.particles.coinBurst(c.x, c.y - 20);
      this.juice.popup(
        c.x,
        c.y - 60,
        t('popup.chest', { sardines: c.sardines }),
        palette.lanternAmber,
        24,
      );
    });
    bus.on('insightStart', () => {
      const h = sim().hero;
      this.juice.shake(juiceConfig.shake.stun);
      this.juice.popup(h.x + 40, h.y - 230, t('popup.insight'), palette.sicklyViolet, 40);
    });
    bus.on('insight', (amount) => {
      const h = sim().hero;
      this.particles.coinBurst(h.x, h.y - 60);
      this.juice.popup(h.x + 40, h.y - 180, `+${formatNumber(amount)}`, palette.lanternAmber, 36);
    });
    bus.on('awakenStart', () => {
      this.awakeningFx.setActive(true);
      this.juice.shake(juiceConfig.shake.stun);
      const h = sim().hero;
      this.juice.popup(h.x + 300, 240, t('popup.awaken'), palette.bioCyan, 44);
    });
    bus.on('awakenEnd', () => this.awakeningFx.setActive(false));
    bus.on('catCatch', (e) => this.catView.dash(e.x, e.y));
    bus.on('catFetch', (e) => {
      this.catView.dash(e.x, e.y);
      this.particles.coinBurst(e.x, e.y);
      this.juice.popup(e.x, e.y - 18, `+${formatNumber(e.reward)}`, palette.lanternAmber, 20);
    });
    bus.on('catHiss', (e) => {
      this.catView.hiss();
      this.juice.popup(e.x, e.y - e.h / 2 - 16, t('popup.hiss'), palette.coral, 22);
    });

    // --- M4: мини-боссы, боссы, биомы ---
    bus.on('eliteSpawn', (e) => {
      this.juice.popup(e.x - 200, 230, t('popup.miniBoss'), palette.coral, 34);
    });
    bus.on('emerge', (e) => this.particles.dustPuff(e.x, e.y + e.h / 2));
    bus.on('bossSpawn', (e) => {
      this.juice.shake(juiceConfig.shake.stun);
      this.juice.popup(
        sim().hero.x + 360,
        200,
        t('popup.boss', { name: tId(`creature.${e.type}`) }),
        palette.coral,
        40,
      );
    });
    bus.on('bossAttack', (e) => {
      this.juice.shake(juiceConfig.shake.armorHit);
      this.particles.dustPuff(e.x - e.w / 2, runConfig.world.groundY);
    });
    bus.on('bossEscaped', () => {
      const h = sim().hero;
      this.juice.popup(h.x + 300, 230, t('popup.bossEscaped'), palette.fog, 30);
    });
    bus.on('bossDefeated', (b) => {
      this.juice.shake(juiceConfig.shake.stun);
      this.juice.hitStop();
      for (let i = 0; i < 4; i++) {
        this.particles.splat(b.x + (i - 1.5) * 50, b.y);
        this.particles.coinBurst(b.x, b.y - i * 30);
      }
      this.popChest(b.x, b.y);
      this.juice.popup(b.x, b.y - 140, t('popup.bossDefeated'), palette.lanternAmber, 44);
      this.juice.popup(b.x, b.y - 90, `+${formatNumber(b.coins)}`, palette.lanternAmber, 34);
    });
    bus.on('biomeChange', (id) => {
      this.crossfadeBiome(id);
      const h = sim().hero;
      this.juice.popup(h.x + 320, 220, tId(`biome.${id}`), palette.parchment, 44);
    });
  }

  /** Сундук выпрыгивает из твари, раскачивается и тает. */
  private popChest(x: number, y: number): void {
    const u = unitScale('chest');
    const img = unitImage(this, 'chest', x, y)
      .setDepth(Depth.fx)
      .setScale(u * 0.3);
    this.tweens.add({ targets: img, scale: u * 1.3, y: y - 70, duration: 260, ease: 'Back.Out' });
    this.tweens.add({
      targets: img,
      angle: { from: -12, to: 12 },
      duration: 120,
      yoyo: true,
      repeat: 3,
    });
    this.tweens.add({
      targets: img,
      alpha: 0,
      y: y - 110,
      delay: 650,
      duration: 300,
      onComplete: () => img.destroy(),
    });
  }

  /** Сон начинается чуть позже, чтобы игрок успел прочитать «страницы сложились». */
  private startDreamSoon(): void {
    if (this.dreamPending) return;
    this.dreamPending = true;
    this.time.delayedCall(DREAM_DELAY_MS, () => this.startDream());
  }

  /** Забег замирает, HUD прячется, поверх запускается сцена сна; по пробуждению всё возвращается. */
  /** Запуск сна (по страницам или из админ-панели). */
  startDream(): void {
    this.dreamPending = false;
    this.sim.release();
    this.scene.pause();
    this.scene.setVisible(false, 'UIScene');
    this.scene.pause('UIScene');
    this.scene.setVisible(false, 'ShopOverlay');
    this.scene.launch('DreamScene', { seed: Math.floor(Math.random() * 2 ** 31) });
  }

  /** Вызывается DreamScene по пробуждению. */
  wakeUp(): void {
    this.scene.resume();
    this.scene.resume('UIScene');
    this.scene.setVisible(true, 'UIScene');
    this.scene.setVisible(true, 'ShopOverlay');
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
    const dt = frozen ? 0 : (deltaMs / 1000) * this.debugTimeScale;
    // Ускорение из админ-панели — подшагами, чтобы не упираться в maxStepSec.
    if (!frozen) for (let i = 0; i < this.debugTimeScale; i++) this.sim.update(deltaMs / 1000);
    // Пассивный доход идёт и во время hit-stop.
    app().session.tick(deltaMs / 1000);

    const sim = this.sim;
    const hero = sim.hero;
    const session = app().session;
    this.elapsed += deltaMs / 1000;
    this.phaseTimer -= deltaMs / 1000;
    if (this.phaseTimer <= 0) {
      this.phaseTimer = PHASE_CHECK_SEC;
      // TODO(M5): время платформы (getServerTime) вместо локальных часов.
      session.updatePhase(Date.now());
    }
    this.cameras.main.scrollX = hero.x - runConfig.hero.screenX;
    this.parallax.update(sim.distancePx, dt);
    this.fadingParallax?.update(sim.distancePx, dt);
    this.heroView.update(hero, hero.x, dt);
    const lantern = this.heroView.lanternWorld();
    this.lanternFx.update(dt, lantern.x, lantern.y);

    this.catView.update(dt, this.elapsed, hero.x, hero.y);
    this.awakeningFx.update(dt, this.elapsed);
    this.distortion.apply(
      sim.sanity.distortion,
      this.elapsed,
      session.state.settings.reduceDistortion,
    );

    const heroCy = hero.y - runConfig.hero.height / 2;
    for (const e of sim.entities) this.views.get(e)?.update(e, sim.time, hero.x, heroCy);
  }
}
