import Phaser from 'phaser';
import { palette, toCss } from '../palette';
import { isRaster, unitScale } from '../textures';
import skin from './skin.json';

export interface ButtonStyle {
  fill: number;
  textColor: number;
  fontSize: number;
  radius: number;
  /** Иконка (ключ текстуры) — показывается, если растровая текстура загрузилась. */
  icon?: string;
  /** Круглый значок вместо таблички (для квадратных кнопок-иконок). */
  badge?: boolean;
  /** Всегда векторная кнопка-карточка (для крупных карточек с текстом поверх). */
  plain?: boolean;
}

const DEFAULT_STYLE: ButtonStyle = {
  fill: palette.lanternAmber,
  textColor: palette.outline,
  fontSize: 22,
  radius: 12,
};

/** Минимальная сторона кликабельной зоны на мобильных (SPEC §10). */
export const MIN_TOUCH = 44;
/** Насколько «проседает» нажатая кнопка. */
const SINK = 3;
const DISABLED_TINT = 0x8a8a8a;

/**
 * Кнопка в стиле игры. Если загружен сгенерированный UI — латунная табличка (nine-slice) или
 * круглый значок с иконкой; иначе — векторный скруглённый прямоугольник. Нажатие — лёгкое
 * проседание; клик срабатывает на отпускании, если палец не ушёл с кнопки.
 */
export class Button extends Phaser.GameObjects.Container {
  readonly label: Phaser.GameObjects.Text;
  private readonly bg:
    Phaser.GameObjects.Graphics | Phaser.GameObjects.NineSlice | Phaser.GameObjects.Image;
  private readonly icon: Phaser.GameObjects.Image | null = null;
  private readonly skinned: boolean;
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
    const bgKey = this.style.badge ? skin.badge.key : skin.button.key;
    this.skinned = !this.style.plain && isRaster(bgKey);

    if (this.skinned && this.style.badge) {
      const img = scene.add.image(0, 0, bgKey);
      img.setScale((bh * skin.badge.fit) / img.height);
      this.bg = img;
    } else if (this.skinned) {
      const u = unitScale(bgKey);
      // Узкой кнопке не хватает места на канатные концы: строим табличку крупнее и уменьшаем.
      const caps = skin.button.left + skin.button.right;
      const k = Math.max(1, ((caps + 16) * u) / bw);
      this.bg = scene.add
        .nineslice(
          0,
          0,
          bgKey,
          undefined,
          (bw * k) / u,
          (bh * k) / u,
          skin.button.left,
          skin.button.right,
          skin.button.top,
          skin.button.bottom,
        )
        .setScale(u / k);
    } else {
      this.bg = scene.add.graphics();
    }

    const iconKey = this.style.icon;
    const showIcon = iconKey !== undefined && scene.textures.exists(iconKey);
    if (showIcon) {
      const img = scene.add.image(0, 0, iconKey);
      // Иконка вписывается в высоту кнопки с запасом.
      img.setScale((bh * 0.62) / Math.max(img.width, img.height));
      this.icon = img;
    }
    const labelText = showIcon && this.style.badge ? '' : text;
    this.label = scene.add
      .text(0, -2, labelText, {
        fontFamily: 'sans-serif',
        fontSize: `${this.style.fontSize}px`,
        fontStyle: 'bold',
        color: toCss(this.style.textColor),
        align: 'center',
      })
      .setOrigin(0.5);
    if (this.icon && labelText) {
      // Иконка слева, подпись правее центра.
      this.icon.setX(-bw / 2 + bh * 0.55);
      this.label.setX(bh * 0.28);
    }
    this.add(this.icon ? [this.bg, this.icon, this.label] : [this.bg, this.label]);
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
    const sink = this.pressed ? SINK : 0;
    this.label.setY(-2 + sink).setAlpha(this.enabled ? 1 : 0.6);
    this.icon?.setY(sink).setAlpha(this.enabled ? 1 : 0.6);

    if (!(this.bg instanceof Phaser.GameObjects.Graphics)) {
      // Табличка латунная: основной цвет — без тонировки, «неактивная» — приглушённая.
      const tint = !this.enabled
        ? DISABLED_TINT
        : this.fill === palette.lanternAmber
          ? 0xffffff
          : palette.plaqueInactive;
      this.bg.setY(sink).setTint(tint);
      return;
    }

    const w = this.bw;
    const h = this.bh;
    const r = this.style.radius;
    const g = this.bg;
    g.clear();
    g.fillStyle(palette.outline, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, r);
    g.fillStyle(this.enabled ? this.fill : palette.fog, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + sink, w, h, r);
    g.lineStyle(3, palette.outline, 1);
    g.strokeRoundedRect(-w / 2, -h / 2 + sink, w, h, r);
  }
}

/** Пергаментная панель с толстой обводкой (векторный вариант). */
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

/**
 * Панель-окно: пергамент в рамке из щупалец и морских узлов (nine-slice из сгенерированного UI),
 * иначе векторная панель. x, y — левый верхний угол.
 */
export function addPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
): Phaser.GameObjects.NineSlice | Phaser.GameObjects.Graphics {
  const key = skin.panel.key;
  if (isRaster(key)) {
    const u = unitScale(key);
    const i = skin.panel.inset;
    return scene.add
      .nineslice(x, y, key, undefined, w / u, h / u, i, i, i, i)
      .setOrigin(0)
      .setScale(u);
  }
  const g = scene.add.graphics();
  drawPanel(g, x, y, w, h);
  return g;
}

/** Тёмная плашка под счётчики HUD. x, y — левый верхний угол. */
export function addPlate(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
): Phaser.GameObjects.NineSlice | Phaser.GameObjects.Graphics {
  const key = skin.plate.key;
  if (isRaster(key)) {
    const u = unitScale(key);
    return scene.add
      .nineslice(
        x,
        y,
        key,
        undefined,
        w / u,
        h / u,
        skin.plate.left,
        skin.plate.right,
        skin.plate.top,
        skin.plate.bottom,
      )
      .setOrigin(0)
      .setScale(u);
  }
  const g = scene.add.graphics();
  g.fillStyle(palette.outline, 0.45);
  g.fillRoundedRect(x, y, w, h, 14);
  return g;
}
