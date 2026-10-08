/**
 * Сборка частей персонажа/твари из сгенерированного листа (dev-only):
 *   node scripts/build-parts.ts assets-src/generated/hero.json [ещё листы…]
 *
 * Лист — части на пурпурном фоне. Для каждой части задаётся точка внутри неё: заливка по маске
 * берёт только эту часть (рамки соседних частей могут пересекаться), края сохраняют полупрозрачность.
 * Результат — WebP в игровом масштабе × textureScale и манифест для PreloadScene.
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import sharp from 'sharp';

interface PartSpec {
  /** Точка внутри части, px исходника: часть берётся заливкой по маске. */
  seed?: [number, number];
  /** Или прямоугольник [x0, y0, x1, y1] — для мягких свечений без чётких краёв. */
  box?: [number, number, number, number];
  /** Дополнительный масштаб части (например, крупнее крылья). */
  scale?: number;
  /** Подогнать высоту части под заданную, в игровых единицах (вместо unitsPerPx). */
  fitHeight?: number;
}

interface Spec {
  src: string;
  outDir: string;
  manifest: string;
  /** Игровых единиц на пиксель исходника. */
  unitsPerPx: number;
  textureScale: number;
  /**
   * chroma — пурпурный фон вырезается (по умолчанию);
   * luma — лист на чёрном фоне (свет): прозрачность = яркость, для аддитивного смешивания.
   */
  keyMode?: 'chroma' | 'luma';
  parts: Record<string, PartSpec>;
}

const KEY_LO = 0.3;
const KEY_HI = 0.85;
/** Насколько расширить маску части, чтобы не потерять сглаженный контур. */
const DILATE = 3;
const PAD = 4;

const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

function keyAlpha(data: Buffer, w: number, h: number): Float32Array {
  const med = (c: number): number => {
    const a: number[] = [];
    for (let x = 0; x < w; x++) a.push(data[x * 4 + c]!);
    a.sort((p, q) => p - q);
    return a[a.length >> 1]!;
  };
  const key = [med(0), med(1), med(2)] as const;
  const km = Math.min(key[0], key[2]) - key[1];
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    const m = Math.min(r, b) - g;
    const a =
      m <= km * KEY_LO
        ? 1
        : m >= km * KEY_HI
          ? 0
          : 1 - (m - km * KEY_LO) / (km * (KEY_HI - KEY_LO));
    alpha[i] = a;
    if (a > 0 && a < 1) {
      // Восстанавливаем цвет края без пурпурного ореола.
      data[i * 4] = clamp((r - (1 - a) * key[0]) / a);
      data[i * 4 + 1] = clamp((g - (1 - a) * key[1]) / a);
      data[i * 4 + 2] = clamp((b - (1 - a) * key[2]) / a);
    }
  }
  return alpha;
}

/** Связная область от seed по пикселям с alpha > 0.5, затем расширение на DILATE px. */
function regionMask(alpha: Float32Array, w: number, h: number, seed: [number, number]): Uint8Array {
  const mask = new Uint8Array(w * h);
  const start = seed[1] * w + seed[0];
  if (alpha[start]! <= 0.5) throw new Error(`Точка ${seed} не попадает в часть`);
  const stack = [start];
  mask[start] = 1;
  while (stack.length) {
    const p = stack.pop()!;
    const x = p % w;
    const neighbors = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w];
    for (const q of neighbors) {
      if (q < 0 || q >= w * h || mask[q] || alpha[q]! <= 0.5) continue;
      mask[q] = 1;
      stack.push(q);
    }
  }
  let grown = mask;
  for (let d = 0; d < DILATE; d++) {
    const next = Uint8Array.from(grown);
    for (let p = 0; p < w * h; p++) {
      if (grown[p]) continue;
      const x = p % w;
      if ((x > 0 && grown[p - 1]) || (x < w - 1 && grown[p + 1]) || grown[p - w] || grown[p + w])
        next[p] = 1;
    }
    grown = next;
  }
  return grown;
}

/** Свет на чёрном фоне: alpha = максимум канала, цвет «распремножается» — так же выглядит в ADD. */
function lumaAlpha(data: Buffer, w: number, h: number): Float32Array {
  const alpha = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    const m = Math.max(r, g, b);
    // Шум JPEG-подобной генерации у чёрного — в ноль.
    const a = m < 6 ? 0 : m / 255;
    alpha[i] = a;
    if (a > 0) {
      data[i * 4] = clamp(r / a);
      data[i * 4 + 1] = clamp(g / a);
      data[i * 4 + 2] = clamp(b / a);
    }
  }
  return alpha;
}

function boxMask(w: number, h: number, box: [number, number, number, number]): Uint8Array {
  const mask = new Uint8Array(w * h);
  const [x0, y0, x1, y1] = box;
  for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) mask[y * w + x] = 1;
  }
  return mask;
}

async function buildSheet(specPath: string): Promise<void> {
  const spec = JSON.parse(readFileSync(specPath, 'utf8')) as Spec;
  const src = join(dirname(specPath), spec.src);
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const alpha = spec.keyMode === 'luma' ? lumaAlpha(data, w, h) : keyAlpha(data, w, h);
  mkdirSync(spec.outDir, { recursive: true });

  // Манифест общий для нескольких листов: дополняем, а не перезаписываем.
  let manifest: Record<string, { file: string; scale: number; width: number; height: number }> = {};
  try {
    manifest = JSON.parse(readFileSync(spec.manifest, 'utf8')) as typeof manifest;
  } catch {
    // Манифеста ещё нет.
  }
  for (const [key, part] of Object.entries(spec.parts)) {
    const mask = part.box ? boxMask(w, h, part.box) : regionMask(alpha, w, h, part.seed ?? [0, 0]);
    let x0 = w;
    let y0 = h;
    let x1 = -1;
    let y1 = -1;
    for (let p = 0; p < w * h; p++) {
      if (!mask[p]) continue;
      const x = p % w;
      const y = (p / w) | 0;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    x0 = Math.max(0, x0 - PAD);
    y0 = Math.max(0, y0 - PAD);
    x1 = Math.min(w - 1, x1 + PAD);
    y1 = Math.min(h - 1, y1 + PAD);
    const cw = x1 - x0 + 1;
    const ch = y1 - y0 + 1;
    const out = Buffer.alloc(cw * ch * 4);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const s = (y0 + y) * w + (x0 + x);
        const d = (y * cw + x) * 4;
        if (!mask[s]) continue;
        out[d] = data[s * 4]!;
        out[d + 1] = data[s * 4 + 1]!;
        out[d + 2] = data[s * 4 + 2]!;
        out[d + 3] = clamp(alpha[s]! * 255);
      }
    }
    const unitsPerPx = part.fitHeight ? part.fitHeight / ch : spec.unitsPerPx;
    const k = unitsPerPx * (part.scale ?? 1) * spec.textureScale;
    const ow = Math.round(cw * k);
    const oh = Math.round(ch * k);
    const file = join(spec.outDir, `${key}.webp`);
    await sharp(out, { raw: { width: cw, height: ch, channels: 4 } })
      .resize(ow, oh, { kernel: 'lanczos3' })
      .webp({ quality: 92, alphaQuality: 100, effort: 6 })
      .toFile(file);
    manifest[key] = {
      file: relative('public', file).replace(/\\/g, '/'),
      scale: spec.textureScale,
      width: ow / spec.textureScale,
      height: oh / spec.textureScale,
    };
    console.log(
      `${key}: ${cw}×${ch} px → ${ow}×${oh} (${(ow / spec.textureScale).toFixed(1)}×${(oh / spec.textureScale).toFixed(1)} ед.)`,
    );
  }
  writeFileSync(spec.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`манифест: ${spec.manifest}`);
}

async function main(): Promise<void> {
  const specs = process.argv.slice(2);
  if (specs.length === 0)
    throw new Error('Укажите JSON листов: node scripts/build-parts.ts <spec.json>…');
  for (const spec of specs) await buildSheet(spec);
}

void main();
