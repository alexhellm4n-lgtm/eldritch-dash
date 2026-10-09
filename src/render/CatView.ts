import type Phaser from 'phaser';
import generatedRig from '../../assets-src/rigs/cat.generated.json';
import { DEFAULT_CAT_SKIN } from '../core/GameState';
import { Depth } from './Parallax';
import { palette } from './palette';
import { isRaster, unitImage } from './textures';

/** Позиция кота относительно ступней героя: чуть позади и выше. */
const FOLLOW_X = -78;
const FOLLOW_Y = -150;
const FOLLOW_EASE = 11;
const DASH_SEC = 0.42;
const FLAP_SPEED = 18;

interface CatRig {
  scale: number;
  parts: readonly {
    name: string;
    key: string;
    x: number;
    y: number;
    ox: number;
    oy: number;
    flip?: boolean;
    shade?: boolean;
  }[];
  poses: { wingBase: number; wingAmp: number; tailBase: number; tailAmp: number };
}

/** Риг векторного кота-плейсхолдера (если сгенерированные части не загрузились). */
const PLACEHOLDER_RIG: CatRig = {
  scale: 1,
  parts: [
    { name: 'wingBack', key: 'cat_wing', x: -4, y: -14, ox: 0.1, oy: 0.9, shade: true },
    { name: 'tail', key: 'cat_tail', x: -24, y: -2, ox: 0.1, oy: 0.85 },
    { name: 'body', key: 'cat_body', x: 0, y: 0, ox: 0.5, oy: 0.5 },
    { name: 'head', key: 'cat_head', x: 24, y: -12, ox: 0.5, oy: 0.5 },
    { name: 'wingFront', key: 'cat_wing', x: 2, y: -14, ox: 0.1, oy: 0.9 },
  ],
  poses: { wingBase: -0.4, wingAmp: 0.6, tailBase: 0, tailAmp: 0.25 },
};

/** Ключ части в шкурке: `cat_head` → `cat_drowned_head`; скин по умолчанию — базовые ключи. */
export function catSkinKey(key: string, skin: string): string {
  return skin === DEFAULT_CAT_SKIN ? key : key.replace(/^cat_/, `cat_${skin}_`);
}

/** Есть ли у скина растровые части (иначе кот остаётся в базовой шкурке). */
export function hasCatSkin(skin: string): boolean {
  return isRaster('cat_body') && isRaster(catSkinKey('cat_body', skin));
}

/**
 * Кот-фамильяр (SPEC §4.7): чёрный, с крошечными крыльями, летит за Эдгаром.
 * На охоте делает рывок к добыче и возвращается; шипит на иллюзии.
 */
export class CatView {
  readonly root: Phaser.GameObjects.Container;
  private readonly rig: CatRig;
  private readonly parts = new Map<string, Phaser.GameObjects.Image>();
  private x = 0;
  private y = 0;
  private dashT = Infinity;
  private dashX = 0;
  private dashY = 0;
  private hissT = Infinity;
  private placed = false;

  constructor(scene: Phaser.Scene) {
    this.rig = isRaster('cat_body') ? generatedRig : PLACEHOLDER_RIG;
    this.root = scene.add
      .container(0, 0)
      .setDepth(Depth.hero + 1)
      .setVisible(false)
      .setScale(this.rig.scale);
    for (const p of this.rig.parts) {
      const img = unitImage(scene, p.key, p.x, p.y)
        .setOrigin(p.ox, p.oy)
        .setFlipX(p.flip === true);
      if (p.shade) img.setTint(palette.farShade);
      this.root.add(img);
      this.parts.set(p.name, img);
    }
  }

  /** Сменить шкурку: части рига те же, меняются только текстуры. */
  setSkin(skin: string): void {
    const id = hasCatSkin(skin) ? skin : DEFAULT_CAT_SKIN;
    if (this.rig === PLACEHOLDER_RIG) return;
    for (const p of this.rig.parts) this.parts.get(p.name)?.setTexture(catSkinKey(p.key, id));
  }

  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
  }

  /** Рывок к добыче (координаты мира). */
  dash(toX: number, toY: number): void {
    this.dashT = 0;
    this.dashX = toX;
    this.dashY = toY;
  }

  hiss(): void {
    this.hissT = 0;
  }

  shift(dx: number): void {
    this.x += dx;
    this.dashX += dx;
  }

  update(dt: number, time: number, heroX: number, heroFeetY: number): void {
    if (!this.root.visible) return;
    const fx = heroX + FOLLOW_X;
    const fy = heroFeetY + FOLLOW_Y + Math.sin(time * 2.4) * 8;
    if (!this.placed) {
      this.x = fx;
      this.y = fy;
      this.placed = true;
    }
    const k = Math.min(1, dt * FOLLOW_EASE);
    this.x += (fx - this.x) * k;
    this.y += (fy - this.y) * k;

    let x = this.x;
    let y = this.y;
    this.dashT += dt;
    if (this.dashT < DASH_SEC) {
      // Туда и обратно по синусу.
      const s = Math.sin((this.dashT / DASH_SEC) * Math.PI);
      x += (this.dashX - this.x) * s;
      y += (this.dashY - this.y) * s;
    }
    this.hissT += dt;
    const hissing = this.hissT < 0.4;
    this.root.setPosition(x + (hissing ? Math.sin(this.hissT * 60) * 3 : 0), y);

    const pose = this.rig.poses;
    const flap = Math.sin(time * FLAP_SPEED);
    this.parts.get('wingFront')?.setRotation(pose.wingBase + pose.wingAmp * flap);
    this.parts
      .get('wingBack')
      ?.setRotation(pose.wingBase + pose.wingAmp * Math.sin(time * FLAP_SPEED + 0.6));
    this.parts.get('tail')?.setRotation(pose.tailBase + pose.tailAmp * Math.sin(time * 3));
    this.parts.get('head')?.setRotation(hissing ? -0.25 : 0.06 * Math.sin(time * 1.7));
  }
}
