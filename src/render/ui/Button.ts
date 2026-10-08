import Phaser from 'phaser';
import { palette, toCss } from '../palette';

export interface ButtonStyle {
  fill: number;
  textColor: number;
  fontSize: number;
  radius: number;
}

const DEFAULT_STYLE: ButtonStyle = {
  fill: palette.lanternAmber,
  textColor: palette.outline,
  fontSize: 22,
  radius: 12,
};

/** Минимальная сторона кликабельной зоны на мобильных (SPEC §10). */
export const MIN_TOUCH = 44;

/**
 * Кнопка в стиле игры: скруглённый прямоугольник с толстой обводкой и «тенью»,
 * нажатие — лёгкое проседание. Клик срабатывает на отпускании, если палец не ушёл с кнопки.
 */
export class Button extends Phaser.GameObjects.Container {
  readonly label: Phaser.GameObjects.Text;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly style: ButtonStyle;
  private enabled = true;
  private pressed = false;
  private fill: number;
  private handler: (() => void) | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly bw: number,
    readonly bh: number,
    text: string,
    style: Partial<ButtonStyle> = {},
  ) {
    super(scene, x, y);
    this.style = { ...DEFAULT_STYLE, ...style };
    this.fill = this.style.fill;
    this.bg = scene.add.graphics();
    this.label = scene.add
      .text(0, -2, text, {
        fontFamily: 'sans-serif',
        fontSize: `${this.style.fontSize}px`,
        fontStyle: 'bold',
        color: toCss(this.style.textColor),
        align: 'center',
      })
      .setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.draw();

    const hitW = Math.max(bw, MIN_TOUCH);
    const hitH = Math.max(bh, MIN_TOUCH);
    this.setSize(hitW, hitH);
    // Для контейнера Phaser отсчитывает зону попадания от левого верхнего угла его размера.
    this.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, hitW, hitH),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      if (!this.enabled) return;
      this.pressed = true;
      this.draw();
    });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
      this.pressed = false;
      this.draw();
    });
    this.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      const fire = this.pressed && this.enabled;
      this.pressed = false;
      this.draw();
      if (fire) this.handler?.();
    });
    scene.add.existing(this);
  }

  onClick(handler: () => void): this {
    this.handler = handler;
    return this;
  }

  setEnabled(enabled: boolean): this {
    if (this.enabled === enabled) return this;
    this.enabled = enabled;
    this.draw();
    return this;
  }

  setFill(color: number): this {
    if (this.fill === color) return this;
    this.fill = color;
    this.draw();
    return this;
  }

  setLabel(text: string): this {
    if (this.label.text !== text) this.label.setText(text);
    return this;
  }

  private draw(): void {
    const w = this.bw;
    const h = this.bh;
    const r = this.style.radius;
    const sink = this.pressed ? 3 : 0;
    const g = this.bg;
    g.clear();
    g.fillStyle(palette.outline, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, r);
    g.fillStyle(this.enabled ? this.fill : palette.fog, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + sink, w, h, r);
    g.lineStyle(3, palette.outline, 1);
    g.strokeRoundedRect(-w / 2, -h / 2 + sink, w, h, r);
    this.label.setY(-2 + sink).setAlpha(this.enabled ? 1 : 0.6);
  }
}

/** Пергаментная панель с толстой обводкой. */
export function drawPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: number = palette.parchment,
  radius = 18,
): void {
  g.fillStyle(palette.outline, 0.55);
  g.fillRoundedRect(x + 6, y + 8, w, h, radius);
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, radius);
  g.lineStyle(4, palette.outline, 1);
  g.strokeRoundedRect(x, y, w, h, radius);
}
