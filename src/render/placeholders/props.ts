import { tones as c } from '../palette';
import { art, stroke, type PlaceholderArt } from './svg';

/** Препятствия побережья, дублон и текстуры частиц/свечения. */
export function propArt(): PlaceholderArt[] {
  return [
    art(
      'barrel',
      68,
      80,
      `
      <path d="M10 6 Q34 0 58 6 Q66 40 58 74 Q34 80 10 74 Q2 40 10 6 Z" fill="${c.wood}" ${stroke()}/>
      <path d="M40 3 Q58 4 58 6 Q66 40 58 74 Q50 77 40 77 Q50 40 40 3 Z" fill="${c.woodShade}"/>
      <path d="M6 22 Q34 28 62 22 M4 58 Q34 64 64 58" fill="none" stroke="${c.fogShade}" stroke-width="6"/>
      <path d="M6 22 Q34 28 62 22 M4 58 Q34 64 64 58" fill="none" ${stroke(2)}/>
      <path d="M10 6 Q34 0 58 6 Q66 40 58 74 Q34 80 10 74 Q2 40 10 6 Z" fill="none" ${stroke()}/>
      <path d="M24 34 Q34 30 44 34 Q34 44 24 34 Z" fill="${c.bioCyan}" opacity="0.8"/>
      <circle cx="34" cy="35" r="2.5" fill="${c.outline}"/>
      `,
    ),
    art(
      'coral',
      82,
      100,
      `
      <path d="M30 96 L32 60 Q14 52 12 30 Q10 16 20 14 Q24 30 34 42 L36 20 Q36 6 46 6 Q54 8 48 26 L46 46 Q60 40 62 22 Q66 10 74 16 Q78 34 58 56 L52 96 Z"
        fill="${c.coral}" ${stroke()}/>
      <path d="M44 48 L46 30 Q50 10 46 8 Q54 8 48 26 L46 46 Q60 40 62 22 Q70 30 58 56 L52 96 L42 96 Z" fill="${c.coralShade}"/>
      <path d="M30 96 L32 60 Q14 52 12 30 Q10 16 20 14 Q24 30 34 42 L36 20 Q36 6 46 6 Q54 8 48 26 L46 46 Q60 40 62 22 Q66 10 74 16 Q78 34 58 56 L52 96 Z"
        fill="none" ${stroke()}/>
      <circle cx="20" cy="26" r="3" fill="${c.parchment}"/>
      <circle cx="44" cy="16" r="3" fill="${c.parchment}"/>
      <circle cx="68" cy="22" r="3" fill="${c.parchment}"/>
      <path d="M22 96 Q42 88 62 96 Z" fill="${c.parchmentShade}" ${stroke(3)}/>
      `,
    ),
    art(
      'netPile',
      116,
      52,
      `
      <path d="M6 48 Q4 26 26 18 Q46 4 72 12 Q104 14 110 48 Z" fill="${c.rope}" ${stroke()}/>
      <path d="M56 12 Q100 14 110 48 L66 48 Q74 30 56 12 Z" fill="${c.ropeShade}"/>
      <g fill="none" stroke="${c.ropeShade}" stroke-width="3">
        <path d="M14 30 L40 48 M30 18 L62 48 M50 10 L86 48 M76 12 L104 40"/>
        <path d="M30 48 L52 12 M56 48 L80 12 M84 48 L100 22 M8 46 L26 18"/>
      </g>
      <path d="M6 48 Q4 26 26 18 Q46 4 72 12 Q104 14 110 48 Z" fill="none" ${stroke()}/>
      <circle cx="40" cy="22" r="6" fill="${c.coral}" ${stroke(3)}/>
      <circle cx="88" cy="28" r="6" fill="${c.amber}" ${stroke(3)}/>
      `,
    ),
    art(
      'coin',
      34,
      34,
      `
      <circle cx="17" cy="17" r="14" fill="${c.amber}" ${stroke(3)}/>
      <path d="M17 3 A14 14 0 0 1 17 31 A10 14 0 0 0 17 3 Z" fill="${c.amberShade}"/>
      <circle cx="17" cy="17" r="14" fill="none" ${stroke(3)}/>
      <circle cx="17" cy="17" r="8.5" fill="none" stroke="${c.amberShade}" stroke-width="2"/>
      <path d="M11 17 Q17 11 23 17 Q17 23 11 17 Z" fill="${c.amberLight}" stroke="${c.amberShade}" stroke-width="1.5"/>
      <circle cx="17" cy="17" r="2.2" fill="${c.outline}"/>
      `,
    ),
    // Мягкое свечение (без обводки) — тонируется и смешивается аддитивно.
    art(
      'glow',
      128,
      128,
      `
      <defs><radialGradient id="g"><stop offset="0" stop-color="#fff" stop-opacity="1"/>
      <stop offset="0.35" stop-color="#fff" stop-opacity="0.45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
      <circle cx="64" cy="64" r="64" fill="url(#g)"/>
      `,
    ),
    art(
      'spark',
      18,
      18,
      `<path d="M9 0 Q10.5 7.5 18 9 Q10.5 10.5 9 18 Q7.5 10.5 0 9 Q7.5 7.5 9 0 Z" fill="${c.amberLight}"/>`,
    ),
    art('puff', 28, 28, `<circle cx="14" cy="14" r="11" fill="${c.violetLight}" ${stroke(3)}/>`),
    art(
      'drop',
      12,
      16,
      `<path d="M6 1 Q11 9 10 11 Q9 15 6 15 Q3 15 2 11 Q1 9 6 1 Z" fill="${c.bioCyan}" ${stroke(2)}/>`,
    ),
    art('dust', 16, 16, `<circle cx="8" cy="8" r="6" fill="${c.parchmentShade}"/>`),
    art(
      'stunStar',
      20,
      20,
      `<path d="M10 1 L12.6 7 L19 7.6 L14 11.8 L15.6 18.4 L10 14.8 L4.4 18.4 L6 11.8 L1 7.6 L7.4 7 Z" fill="${c.amberLight}" ${stroke(2)}/>`,
    ),
    art('pixel', 4, 4, `<rect width="4" height="4" fill="#fff"/>`),
    // Выстрел фонаря (плейсхолдеры для растровых fx_*): вспышка, луч, всплеск.
    art(
      'fx_muzzle',
      72,
      72,
      `<path d="M36 0 L42 30 L72 36 L42 42 L36 72 L30 42 L0 36 L30 30 Z" fill="${c.amberLight}"/>
       <circle cx="36" cy="36" r="9" fill="${c.white}"/>`,
    ),
    art(
      'fx_bolt',
      78,
      36,
      `<defs><linearGradient id="b" x1="0" x2="1"><stop offset="0" stop-color="${c.amber}" stop-opacity="0"/>
       <stop offset="1" stop-color="${c.amberLight}"/></linearGradient></defs>
       <path d="M0 18 Q50 6 72 10 Q80 18 72 26 Q50 30 0 18 Z" fill="url(#b)"/>
       <ellipse cx="68" cy="18" rx="7" ry="5" fill="${c.white}"/>`,
    ),
    art(
      'fx_impact',
      84,
      84,
      `<circle cx="42" cy="42" r="30" fill="none" stroke="${c.amberLight}" stroke-width="6"/>
       <circle cx="42" cy="42" r="10" fill="${c.white}"/>`,
    ),
  ];
}
