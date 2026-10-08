/**
 * Сборка сгенерированных фонов параллакса (dev-only):
 *   node scripts/build-bg.ts [assets-src/generated/coast.json]
 *
 * Для каждого слоя: убирает пурпурный фон (#FF00FF) с восстановлением полупрозрачности,
 * обрезает пустые строки сверху, масштабирует к нужной высоте в игровых единицах (1280×720),
 * сводит левый и правый края для бесшовного тайлинга и пишет WebP + манифест размещения.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import sharp from 'sharp';

interface LayerSpec {
  key: string;
  src: string;
  /** Высота исходной картинки целиком в игровых единицах. */
  height: number;
  /** Где в кадре 1280×720 окажется нижний край картинки. */
  bottom: number;
  chroma: boolean;
  /** Ширина зоны сведения краёв, доля ширины. */
  blend: number;
  /**
   * Цвет, в который перекрашиваются полупрозрачные пиксели (с сохранением яркости).
   * Нужен, когда генератор рисует свечение розоватым переходом в фон, а не честной прозрачностью.
   */
  spillTint?: string;
  /**
   * Полупрозрачное свечение (луч маяка), нарисованное генератором как переход в фон.
   * В прямоугольнике rect (px исходника) альфа = проекция цвета на отрезок «фон → цвет у source»,
   * цвет заменяется на color.
   */
  glow?: {
    rect: [number, number, number, number];
    source: [number, number];
    color: string;
    strength: number;
  };
}

interface Spec {
  outDir: string;
  manifest: string;
  layers: LayerSpec[];
}

/** «Пурпурность» пикселя: у #FF00FF = 255, у обычных цветов игры — около нуля. */
const magentaness = (r: number, g: number, b: number): number => Math.min(r, b) - g;
/** Доли от «пурпурности» фона: ниже LO — непрозрачно, выше HI — полностью фон. */
const KEY_LO = 0.3;
const KEY_HI = 0.85;

/** Цвет фона — медиана верхней строки (у слоёв с хромакеем там всегда фон). */
function estimateKey(data: Buffer, w: number): [number, number, number] {
  const ch: number[][] = [[], [], []];
  for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) ch[c]!.push(data[x * 4 + c]!);
  const med = (a: number[]): number => a.sort((p, q) => p - q)[a.length >> 1]!;
  return [med(ch[0]!), med(ch[1]!), med(ch[2]!)];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const luma = (r: number, g: number, b: number): number => 0.3 * r + 0.59 * g + 0.11 * b;

function chromaKey(data: Buffer, w: number, spillTint?: string): void {
  const tint = spillTint ? hexToRgb(spillTint) : null;
  const tintLuma = tint ? luma(...tint) : 1;
  const [kr, kg, kb] = estimateKey(data, w);
  const km = magentaness(kr, kg, kb);
  const lo = km * KEY_LO;
  const hi = km * KEY_HI;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const m = magentaness(r, g, b);
    const a = m <= lo ? 1 : m >= hi ? 0 : 1 - (m - lo) / (hi - lo);
    if (a >= 1) continue;
    if (a <= 0) {
      data[i] = data[i + 1] = data[i + 2] = data[i + 3] = 0;
      continue;
    }
    // Пиксель = a·F + (1−a)·K → восстанавливаем цвет переднего плана F.
    let fr = (r - (1 - a) * kr) / a;
    let fg = (g - (1 - a) * kg) / a;
    let fb = (b - (1 - a) * kb) / a;
    if (tint) {
      const k = luma(fr, fg, fb) / tintLuma;
      fr = tint[0] * k;
      fg = tint[1] * k;
      fb = tint[2] * k;
    }
    data[i] = clamp(fr);
    data[i + 1] = clamp(fg);
    data[i + 2] = clamp(fb);
    data[i + 3] = Math.round(a * 255);
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/** Первая строка сверху с заметным содержимым (одиночные шумовые пиксели не в счёт). */
function firstOpaqueRow(data: Buffer, w: number, h: number): number {
  const minCount = Math.max(2, Math.round(w * 0.002));
  for (let y = 0; y < h; y++) {
    let count = 0;
    for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3]! > 64) count++;
    if (count >= minCount) return y;
  }
  return h;
}

/**
 * Бесшовность: первые B колонок плавно смешиваются с последними B, после чего последние
 * B колонок отрезаются. Тогда за правым краем результата продолжается его левый край.
 * Смешивание в premultiplied alpha, чтобы полупрозрачные края не темнели.
 */
function makeSeamless(
  data: Buffer,
  w: number,
  h: number,
  blend: number,
): { data: Buffer; w: number } {
  const b = Math.max(1, Math.round(w * blend));
  const outW = w - b;
  const out = Buffer.alloc(outW * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < outW; x++) {
      const di = (y * outW + x) * 4;
      const si = (y * w + x) * 4;
      if (x >= b) {
        data.copy(out, di, si, si + 4);
        continue;
      }
      const t = x / b;
      const ti = (y * w + (outW + x)) * 4;
      const a1 = data[si + 3]! / 255;
      const a2 = data[ti + 3]! / 255;
      const a = a1 * t + a2 * (1 - t);
      for (let c = 0; c < 3; c++) {
        const p = data[si + c]! * a1 * t + data[ti + c]! * a2 * (1 - t);
        out[di + c] = a > 0 ? clamp(p / a) : 0;
      }
      out[di + 3] = clamp(a * 255);
    }
  }
  return { data: out, w: outW };
}

/** Пересчёт свечения в прямоугольнике по исходным (до хромакея) пикселям. */
/** Ниже этой доли проекции — шум фона, а не свечение. */
const GLOW_FLOOR = 0.12;

function rebuildGlow(
  src: Buffer,
  dst: Buffer,
  w: number,
  glow: NonNullable<LayerSpec['glow']>,
): void {
  const [x0, y0, x1, y1] = glow.rect;
  // Фон локально: медиана верхней строки прямоугольника (там только пурпур).
  const row = src.subarray((y0 * w + x0) * 4, (y0 * w + x1) * 4);
  const key = estimateKey(row, x1 - x0);
  const si = (glow.source[1] * w + glow.source[0]) * 4;
  const base = [src[si]! - key[0], src[si + 1]! - key[1], src[si + 2]! - key[2]];
  const len2 = base[0]! ** 2 + base[1]! ** 2 + base[2]! ** 2;
  const [cr, cg, cb] = hexToRgb(glow.color);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      const d0 = src[i]! - key[0];
      const d1 = src[i + 1]! - key[1];
      const d2 = src[i + 2]! - key[2];
      const p = (d0 * base[0]! + d1 * base[1]! + d2 * base[2]!) / len2;
      const t = Math.max(0, Math.min(1, (p - GLOW_FLOOR) / (1 - GLOW_FLOOR)));
      dst[i] = cr;
      dst[i + 1] = cg;
      dst[i + 2] = cb;
      // Свечение плавно гаснет к дальнему концу.
      const fade = 1 - (x - x0) / (x1 - x0);
      dst[i + 3] = clamp(t * glow.strength * fade * 255);
    }
  }
}

async function buildLayer(spec: Spec, layer: LayerSpec, baseDir: string) {
  const src = join(baseDir, layer.src);
  const raw = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: srcW, height: srcH } = raw.info;
  const pixels = raw.data;
  const original = layer.glow ? Buffer.from(pixels) : null;
  if (layer.chroma) chromaKey(pixels, srcW, layer.spillTint);
  if (layer.glow && original) rebuildGlow(original, pixels, srcW, layer.glow);

  // Пустой верх не храним: экономим память GPU, сдвиг учитываем в манифесте.
  const top = layer.chroma ? Math.max(0, firstOpaqueRow(pixels, srcW, srcH) - 4) : 0;
  const scale = layer.height / srcH;
  const outH = Math.round((srcH - top) * scale);
  const outW = Math.round(srcW * scale);

  const resized = await sharp(pixels, { raw: { width: srcW, height: srcH, channels: 4 } })
    .extract({ left: 0, top, width: srcW, height: srcH - top })
    .resize(outW, outH, { kernel: 'lanczos3' })
    .raw()
    .toBuffer();
  const seamless = makeSeamless(resized, outW, outH, layer.blend);

  const file = join(spec.outDir, `${layer.key}.webp`);
  mkdirSync(spec.outDir, { recursive: true });
  await sharp(seamless.data, { raw: { width: seamless.w, height: outH, channels: 4 } })
    .webp({ quality: 88, alphaQuality: 90, effort: 6 })
    .toFile(file);

  const y = layer.bottom - outH;
  console.log(`${layer.key}: ${seamless.w}×${outH} at y=${y} → ${file}`);
  return { file: relative('public', file).replace(/\\/g, '/'), y, width: seamless.w, height: outH };
}

async function main(): Promise<void> {
  const specPath = process.argv[2] ?? 'assets-src/generated/coast.json';
  const spec = JSON.parse(readFileSync(specPath, 'utf8')) as Spec;
  const baseDir = dirname(specPath);

  let manifest: Record<string, unknown> = {};
  try {
    manifest = JSON.parse(readFileSync(spec.manifest, 'utf8')) as Record<string, unknown>;
  } catch {
    // Манифеста ещё нет — создадим.
  }
  for (const layer of spec.layers) manifest[layer.key] = await buildLayer(spec, layer, baseDir);
  writeFileSync(spec.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`манифест: ${spec.manifest}`);
}

void main();
