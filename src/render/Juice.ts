import type Phaser from 'phaser';
import { juiceConfig, type ShakeConfig } from '../config';
import { Depth } from './Parallax';
import { toCss } from './palette';

interface Popup {
  text: Phaser.GameObjects.Text;
  life: number;
  startY: number;
}

/** Всплывающие цифры, тряска камеры, hit-stop (SPEC §8.3). */
export class Juice {
  private readonly popups: Popup[] = [];
  private next = 0;
  /** Остаток hit-stop, мс: пока > 0, сцена не двигает симуляцию. */
  hitStopLeft = 0;

  constructor(private readonly scene: Phaser.Scene) {
    for (let i = 0; i < juiceConfig.popup.poolSize; i++) {
      const text = scene.add
        .text(0, 0, '', {
          fontFamily: 'Georgia, serif',
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: '#1a1426',
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(Depth.popup)
        .setVisible(false);
      this.popups.push({ text, life: 0, startY: 0 });
    }
  }

  popup(x: number, y: number, label: string, color: number, size = 24): void {
    const p = this.popups[this.next]!;
    this.next = (this.next + 1) % this.popups.length;
    p.life = 1;
    p.startY = y;
    p.text
      .setText(label)
      .setColor(toCss(color))
      .setFontSize(size)
      .setPosition(x, y)
      .setAlpha(1)
      .setScale(1.3)
      .setVisible(true);
  }

  shake(cfg: ShakeConfig): void {
    this.scene.cameras.main.shake(cfg.ms, cfg.intensity);
  }

  hitStop(ms = juiceConfig.hitStopMs): void {
    this.hitStopLeft = Math.max(this.hitStopLeft, ms);
  }

  update(dtMs: number): void {
    this.hitStopLeft = Math.max(0, this.hitStopLeft - dtMs);
    const step = dtMs / juiceConfig.popup.ms;
    for (const p of this.popups) {
      if (p.life <= 0) continue;
      p.life -= step;
      if (p.life <= 0) {
        p.text.setVisible(false);
        continue;
      }
      const k = 1 - p.life;
      p.text
        .setY(p.startY - juiceConfig.popup.risePx * Math.sin((k * Math.PI) / 2))
        .setAlpha(Math.min(1, p.life * 2.5))
        .setScale(1 + 0.3 * Math.max(0, 1 - k * 5));
    }
  }

  shift(dx: number): void {
    for (const p of this.popups) if (p.life > 0) p.text.x += dx;
  }
}
