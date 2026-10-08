import type Phaser from 'phaser';
import display from '../config/display.json';
import type { BiomeConfig } from '../config';
import { backgroundAssets } from './rasterAssets';
import { palette } from './palette';
import { isRaster, unitScale } from './textures';

/** Глубины (z-order) сцены забега. */
export const Depth = {
  sky: 0,
  far: 1,
  mid: 2,
  fogBack: 3,
  near: 4,
  ground: 5,
  obstacle: 6,
  coin: 7,
  enemy: 8,
  hero: 10,
  fx: 20,
  fogFront: 25,
  popup: 30,
} as const;

/**
 * 4 слоя параллакса + настил + два слоя тумана. Слои привязаны к камере и сдвигаются
 * по пройденной дистанции, поэтому rebase мира на них не влияет.
 */
export class Parallax {
  private readonly layers: Phaser.GameObjects.TileSprite[] = [];
  private readonly ground: Phaser.GameObjects.TileSprite;
  private readonly fogBack: Phaser.GameObjects.TileSprite;
  private readonly fogFront: Phaser.GameObjects.TileSprite;
  private drift = 0;

  constructor(
    scene: Phaser.Scene,
    biomeId: string,
    private readonly biome: BiomeConfig,
    groundY: number,
  ) {
    const W = display.width;
    const H = display.height;
    const depths = [Depth.sky, Depth.far, Depth.mid, Depth.near];
    for (let i = 0; i < biome.parallax.length; i++) {
      const key = `bg_${biomeId}_layer${i}`;
      // Растровый слой лежит полосой на своей высоте; плейсхолдер занимает весь кадр.
      const asset = isRaster(key) ? backgroundAssets[key] : undefined;
      const y = asset?.y ?? 0;
      const h = asset?.height ?? H;
      this.layers.push(this.tile(scene, key, 0, y, W, h, depths[i] ?? Depth.near));
    }
    // Ближний декор притемнён, чтобы не спорить по яркости с настоящими препятствиями и тварями.
    this.layers[this.layers.length - 1]?.setTint(palette.nearDecorShade);
    // Растровая земля лежит на своей высоте (верх настила = уровень земли), плейсхолдер — от groundY.
    const groundKey = `ground_${biomeId}`;
    const groundAsset = isRaster(groundKey) ? backgroundAssets[groundKey] : undefined;
    const groundTop = groundAsset?.y ?? groundY - 4;
    this.ground = this.tile(
      scene,
      groundKey,
      0,
      groundTop,
      W,
      groundAsset?.height ?? H - groundTop,
      Depth.ground,
    );
    this.fogBack = this.tile(
      scene,
      `fog_${biomeId}`,
      0,
      groundY - 230,
      W,
      240,
      Depth.fogBack,
    ).setAlpha(0.9);
    this.fogFront = this.tile(
      scene,
      `fog_${biomeId}`,
      0,
      groundY - 120,
      W,
      240,
      Depth.fogFront,
    ).setAlpha(0.35);
  }

  private tile(
    scene: Phaser.Scene,
    key: string,
    x: number,
    y: number,
    w: number,
    h: number,
    depth: number,
  ): Phaser.GameObjects.TileSprite {
    const s = unitScale(key);
    return scene.add
      .tileSprite(x, y, w, h, key)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(depth)
      .setTileScale(s, s);
  }

  update(distancePx: number, dtSec: number): void {
    this.drift += this.biome.fogDriftPxPerSec * dtSec;
    for (let i = 0; i < this.layers.length; i++) {
      this.layers[i]!.tilePositionX = distancePx * (this.biome.parallax[i] ?? 0);
    }
    this.ground.tilePositionX = distancePx;
    this.fogBack.tilePositionX = distancePx * 0.45 + this.drift;
    this.fogFront.tilePositionX = distancePx * 1.15 + this.drift * 1.7;
  }
}
