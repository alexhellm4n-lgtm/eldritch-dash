import type Phaser from 'phaser';
import { palette } from './palette';
import { unitImage } from './textures';

export interface RigPartDef {
  name: string;
  key: string;
  x: number;
  y: number;
  /** Точка вращения (origin) в долях текстуры. */
  ox: number;
  oy: number;
  /** Дальняя часть (задняя нога/крыло) — притемняется. */
  shade?: boolean;
}

export interface RigDef {
  parts: readonly RigPartDef[];
}

/**
 * Cut-out персонаж: части-изображения в контейнере, точки вращения из assets-src/rigs/*.json.
 * Позы задаёт вызывающий код через `part(name)` (rotation/x/y), базовые позиции хранятся в `base`.
 */
export class CutoutRig {
  readonly container: Phaser.GameObjects.Container;
  private readonly parts = new Map<string, Phaser.GameObjects.Image>();
  readonly base = new Map<string, { x: number; y: number }>();
  /** Масштаб каждой части относительно игровых единиц (нужен для squash/stretch частей). */
  readonly unit = new Map<string, number>();

  constructor(scene: Phaser.Scene, def: RigDef) {
    this.container = scene.add.container(0, 0);
    for (const p of def.parts) {
      const img = unitImage(scene, p.key, p.x, p.y).setOrigin(p.ox, p.oy);
      if (p.shade) img.setTint(palette.farShade);
      this.container.add(img);
      this.parts.set(p.name, img);
      this.base.set(p.name, { x: p.x, y: p.y });
      this.unit.set(p.name, img.scaleX);
    }
  }

  has(name: string): boolean {
    return this.parts.has(name);
  }

  part(name: string): Phaser.GameObjects.Image {
    const p = this.parts.get(name);
    if (!p) throw new Error(`CutoutRig: нет части ${name}`);
    return p;
  }

  /** Возвращает часть в базовую позу. */
  resetPose(): void {
    for (const [name, img] of this.parts) {
      const b = this.base.get(name)!;
      const u = this.unit.get(name)!;
      img.setPosition(b.x, b.y).setRotation(0).setScale(u);
    }
  }
}

/**
 * Цепочка сегментов-щупалец с синусоидальным покачиванием (SPEC §8.2).
 * Сегменты уменьшаются к кончику; каждый следующий повёрнут относительно предыдущего.
 */
export class TentacleChain {
  readonly segments: Phaser.GameObjects.Image[] = [];

  constructor(
    scene: Phaser.Scene,
    parent: Phaser.GameObjects.Container,
    private readonly rootX: number,
    private readonly rootY: number,
    count: number,
    private readonly spacing: number,
    tint: number,
    private readonly size = 1,
  ) {
    for (let i = 0; i < count; i++) {
      const seg = unitImage(scene, 'seg').setTint(tint);
      seg.setScale(seg.scaleX * size * (1 - (i / count) * 0.55));
      parent.add(seg);
      this.segments.push(seg);
    }
  }

  /** baseAngle — направление цепочки (0 = вниз), amp — амплитуда изгиба на сегмент. */
  update(time: number, baseAngle: number, amp: number, freq: number, phase: number): void {
    let x = this.rootX;
    let y = this.rootY;
    let angle = baseAngle;
    const step = this.spacing * this.size;
    for (let i = 0; i < this.segments.length; i++) {
      angle += amp * Math.sin(time * freq + phase + i * 0.9);
      this.segments[i]!.setPosition(x, y);
      x -= Math.sin(angle) * step;
      y += Math.cos(angle) * step;
    }
  }
}
