import type Phaser from 'phaser';

/** С каким масштабом растеризована каждая текстура (PNG@2x → 2). */
const rasterScale = new Map<string, number>();

export function registerTextureScale(key: string, scale: number): void {
  rasterScale.set(key, scale);
}

/** Ключи, для которых реально загружен растровый ассет (а не SVG-плейсхолдер). */
const loadedRaster = new Set<string>();

export function markRasterLoaded(key: string): void {
  loadedRaster.add(key);
}

/** true — текстура взята из растрового ассета; false — плейсхолдер (ассета нет или не загрузился). */
export function isRaster(key: string): boolean {
  return loadedRaster.has(key);
}

/** Множитель, приводящий текстуру к игровым единицам 1280×720. */
export function unitScale(key: string): number {
  return 1 / (rasterScale.get(key) ?? 1);
}

/** Изображение в игровых единицах. */
export function unitImage(
  scene: Phaser.Scene,
  key: string,
  x = 0,
  y = 0,
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, key).setScale(unitScale(key));
}
