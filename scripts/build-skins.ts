/**
 * Скины кота перекраской готовых частей (dev-only):
 *   node scripts/build-skins.ts assets-src/generated/cat_skins.json
 *
 * Берёт собранные части базового кота (`<base>_<part>.webp`) и перекрашивает мех и крылья:
 * пиксели в диапазоне оттенков `hues` (и тёмная обводка) получают цвет из рампы по исходной
 * светлоте — тени и блики сохраняются. Глаза, нос и блики глаз не трогаются; `eyeHue` поворачивает
 * оттенок радужки. Результат — `<base>_<skin>_<part>.webp` и записи в общем манифесте.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

/** Точка рампы: светлота исходника (0…1) → цвет. */
type Ramp = readonly (readonly [number, string])[];

interface SkinSpec {
  /** Рампа для головы, тела и хвоста. */
  fur: Ramp;
  /** Рампа для крыльев. */
  wing: Ramp;
  /** Новый оттенок радужки, градусы. */
  eyeHue?: number;
  /** Прозрачность крыльев (призрачные перепонки). */
  wingAlpha?: number;
}

interface Spec {
  srcDir: string;
  outDir: string;
  manifest: string;
  base: string;
  parts: string[];
  /** Диапазон оттенков меха и крыльев, градусы. */
  hues: [number, number];
  skins: Record<string, SkinSpec>;
}

type Manifest = Record<string, { file: string; scale: number; width: number; height: number }>;

const clamp = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r / 255) h = ((g - b) / 255 / d) % 6;
  else if (max === g / 255) h = (b - r) / 255 / d + 2;
  else h = (r - g) / 255 / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function sampleRamp(ramp: readonly (readonly [number, number[]])[], l: number): number[] {
  const first = ramp[0]!;
  if (l <= first[0]) return first[1];
  for (let i = 1; i < ramp.length; i++) {
    const [l1, c1] = ramp[i]!;
    if (l > l1) continue;
    const [l0, c0] = ramp[i - 1]!;
    const k = (l - l0) / (l1 - l0);
    return c0.map((v, j) => v + (c1[j]! - v) * k);
  }
  return ramp[ramp.length - 1]![1];
}

async function buildSkins(specPath: string): Promise<void> {
  const spec = JSON.parse(readFileSync(specPath, 'utf8')) as Spec;
  const manifest = JSON.parse(readFileSync(spec.manifest, 'utf8')) as Manifest;
  const [hueLo, hueHi] = spec.hues;

  for (const [skin, s] of Object.entries(spec.skins)) {
    const fur = s.fur.map(([l, c]) => [l, hex(c)] as const);
    const wing = s.wing.map(([l, c]) => [l, hex(c)] as const);
    for (const part of spec.parts) {
      const srcKey = `${spec.base}_${part}`;
      const src = manifest[srcKey];
      if (!src) throw new Error(`Нет базовой части ${srcKey} в манифесте`);
      const { data, info } = await sharp(join(spec.srcDir, `${srcKey}.webp`))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const ramp = part === 'wing' ? wing : fur;
      const alphaK = part === 'wing' ? (s.wingAlpha ?? 1) : 1;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        const [h, sat, l] = rgbToHsl(data[i]!, data[i + 1]!, data[i + 2]!);
        const inFur = h >= hueLo && h <= hueHi && sat >= 0.04;
        // Почти серая тёмная обводка — тоже мех; светлые серые — блики глаз.
        const outline = sat < 0.12 && l < 0.5;
        if (inFur || outline) {
          const c = sampleRamp(ramp, l);
          data[i] = clamp(c[0]!);
          data[i + 1] = clamp(c[1]!);
          data[i + 2] = clamp(c[2]!);
          data[i + 3] = clamp(data[i + 3]! * alphaK);
        } else if (s.eyeHue !== undefined && h < 60 && sat > 0.35 && l > 0.25) {
          // Радужка: поворачиваем оттенок, сохраняя переход от центра к краю.
          const c = hslToRgb((s.eyeHue + h - 30 + 360) % 360, sat, l);
          data[i] = clamp(c[0]);
          data[i + 1] = clamp(c[1]);
          data[i + 2] = clamp(c[2]);
        }
      }
      const key = `${spec.base}_${skin}_${part}`;
      const file = join(spec.outDir, `${key}.webp`);
      await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
        .webp({ quality: 92, alphaQuality: 100, effort: 6 })
        .toFile(file);
      manifest[key] = { ...src, file: src.file.replace(`${srcKey}.webp`, `${key}.webp`) };
      console.log(`${key}: ${info.width}×${info.height}`);
    }
  }
  writeFileSync(spec.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`манифест: ${spec.manifest}`);
}

async function main(): Promise<void> {
  const specs = process.argv.slice(2);
  if (specs.length === 0)
    throw new Error('Укажите JSON скинов: node scripts/build-skins.ts <spec.json>…');
  for (const spec of specs) await buildSkins(spec);
}

void main();
