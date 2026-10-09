import { tones as c } from '../palette';
import { art, stroke, type PlaceholderArt } from './svg';

/** Пустой белый глаз: зрачок рисует вид и ведёт его за героем. */
const eye = (x: number, y: number, r: number): string =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.white}" ${stroke(3)}/>`;

/** Цвета гнилого леса и затонувшего города (производные тона, SPEC §8.1). */
const f = {
  moss: '#3E6B4A',
  mossShade: '#2C4F37',
  bark: '#5B4636',
  barkShade: '#43332A',
  shroom: '#C0507A',
  shroomShade: '#913A5C',
  glow: '#B6F25C',
};
const d = {
  stone: '#4F6B78',
  stoneShade: '#3A5260',
  coralPink: '#E58FA8',
  jelly: '#9C7BE0',
  jellyShade: '#7458B8',
  deep: '#1E3A5C',
};

/** Твари гнилого леса и затонувшего города, боссы, их волны и препятствия биомов. */
export function creatureArt(): PlaceholderArt[] {
  return [
    // --- Гнилой лес ---
    // Грибной сектант: балахон, шляпка-капюшон, светящиеся глаза.
    art(
      'cultist_body',
      64,
      92,
      `
      <path d="M14 40 Q32 34 50 40 L58 90 Q32 96 6 90 Z" fill="${c.violetShade}" ${stroke()}/>
      <path d="M32 40 L34 90 M20 58 Q32 64 44 58" fill="none" stroke="${c.violet}" stroke-width="4"/>
      <ellipse cx="32" cy="50" rx="16" ry="12" fill="${c.outline}"/>
      ${eye(26, 49, 5.5)}${eye(39, 49, 5.5)}
      <path d="M2 30 Q4 4 32 4 Q60 4 62 30 Q32 40 2 30 Z" fill="${f.shroom}" ${stroke()}/>
      <path d="M6 30 Q32 38 58 30 Q32 44 6 30 Z" fill="${f.shroomShade}"/>
      <circle cx="18" cy="16" r="5" fill="${c.parchment}"/><circle cx="38" cy="11" r="4" fill="${c.parchment}"/>
      <circle cx="50" cy="22" r="3.5" fill="${c.parchment}"/>
      `,
    ),
    art(
      'cultist_leg',
      18,
      24,
      `<rect x="5" y="1" width="8" height="14" rx="3" fill="${c.violetShade}" ${stroke(3)}/>
       <path d="M2 22 Q3 14 9 14 Q17 14 17 22 Z" fill="${c.outline}"/>`,
    ),
    // Глазастый куст: броня из листвы, большой глаз посередине.
    art(
      'bush_body',
      100,
      88,
      `
      <path d="M8 86 Q0 60 14 44 Q10 22 32 18 Q42 2 60 8 Q82 6 86 26 Q100 38 94 60 Q100 80 90 86 Z" fill="${f.moss}" ${stroke()}/>
      <path d="M14 80 Q30 70 50 78 Q70 70 88 80 L90 86 L8 86 Z" fill="${f.mossShade}"/>
      <path d="M20 40 Q26 34 32 40 M64 22 Q70 16 76 22 M76 58 Q82 52 88 58 M14 64 Q20 58 26 64" fill="none" stroke="${f.mossShade}" stroke-width="3"/>
      ${eye(50, 46, 16)}${eye(24, 30, 7)}${eye(76, 28, 8)}
      <circle cx="40" cy="72" r="3" fill="${f.shroom}"/><circle cx="66" cy="74" r="3" fill="${f.shroom}"/>
      `,
    ),
    // Светлячок-наблюдатель: круглое тельце, фонарик-брюшко, один большой глаз.
    art(
      'firefly_body',
      58,
      44,
      `
      <ellipse cx="14" cy="26" rx="12" ry="11" fill="${f.glow}" ${stroke(3)}/>
      <ellipse cx="14" cy="26" rx="6" ry="5" fill="${c.white}" opacity="0.7"/>
      <ellipse cx="34" cy="22" rx="18" ry="15" fill="${c.coat}" ${stroke()}/>
      ${eye(40, 20, 9)}
      <path d="M44 8 Q50 0 54 4 M38 8 Q40 0 46 0" fill="none" ${stroke(2.5)}/>
      `,
    ),
    art(
      'firefly_wing',
      34,
      24,
      `<path d="M3 21 Q2 4 20 2 Q34 2 31 12 Q26 22 3 21 Z" fill="${c.fog}" opacity="0.85" ${stroke(2.5)}/>
       <path d="M8 18 Q16 10 26 8" fill="none" stroke="${c.white}" stroke-width="2" opacity="0.7"/>`,
    ),
    // Корнеход: пень на корнях, выглядывающие глаза.
    art(
      'root_body',
      84,
      60,
      `
      <path d="M8 58 Q4 30 18 18 Q30 6 50 8 Q74 8 80 30 Q84 50 76 58 Z" fill="${f.bark}" ${stroke()}/>
      <path d="M14 58 Q16 40 22 30 M34 58 Q34 34 40 20 M60 58 Q58 40 66 28" fill="none" stroke="${f.barkShade}" stroke-width="4"/>
      <ellipse cx="48" cy="14" rx="26" ry="7" fill="${f.moss}" ${stroke(3)}/>
      ${eye(54, 26, 7)}${eye(68, 28, 6)}
      `,
    ),
    art(
      'root_leg',
      32,
      22,
      `<path d="M3 5 Q14 2 22 10 Q28 16 30 20 Q20 18 14 14 Q8 10 3 12 Z" fill="${f.barkShade}" ${stroke(3)}/>`,
    ),
    art(
      'mound',
      96,
      32,
      `<path d="M2 30 Q12 6 48 4 Q84 6 94 30 Z" fill="${f.barkShade}" ${stroke(3)}/>
       <circle cx="30" cy="18" r="3" fill="${f.bark}"/><circle cx="58" cy="14" r="4" fill="${f.bark}"/>
       <circle cx="72" cy="22" r="2.5" fill="${f.bark}"/>`,
    ),

    // --- Затонувший город ---
    // Полип: высокий коралловый стебель, глаз на макушке, венчик щупалец.
    art(
      'polyp_stalk',
      40,
      92,
      `
      <path d="M8 90 Q6 50 10 24 Q12 8 20 8 Q28 8 30 24 Q34 50 32 90 Z" fill="${d.coralPink}" ${stroke()}/>
      <path d="M10 40 Q20 46 31 40 M9 58 Q20 64 32 58 M8 76 Q20 82 32 76" fill="none" stroke="${c.coralShade}" stroke-width="3"/>
      ${eye(20, 20, 8)}
      `,
    ),
    art(
      'polyp_tentacle',
      14,
      40,
      `<path d="M7 38 Q2 26 7 16 Q12 6 7 2" fill="none" stroke="${c.outline}" stroke-width="8" stroke-linecap="round"/>
       <path d="M7 38 Q2 26 7 16 Q12 6 7 2" fill="none" stroke="${d.coralPink}" stroke-width="4" stroke-linecap="round"/>`,
    ),
    // Звёздная медуза: купол со звёздами.
    art(
      'jelly_bell',
      72,
      52,
      `
      <path d="M4 44 Q2 4 36 3 Q70 4 68 44 Q58 50 48 44 Q36 52 24 44 Q14 50 4 44 Z" fill="${d.jelly}" opacity="0.92" ${stroke()}/>
      <path d="M10 40 Q36 30 62 40" fill="none" stroke="${d.jellyShade}" stroke-width="4"/>
      <path d="M50 12 L52 17 L57 17 L53 20 L55 25 L50 22 L45 25 L47 20 L43 17 L48 17 Z" fill="${c.amberLight}"/>
      <circle cx="18" cy="16" r="2" fill="${c.bioCyan}"/><circle cx="60" cy="30" r="2" fill="${c.bioCyan}"/>
      ${eye(27, 30, 6)}${eye(45, 30, 6)}
      `,
    ),
    art(
      'jelly_tentacle',
      14,
      48,
      `<path d="M7 2 Q12 14 6 24 Q1 34 8 46" fill="none" stroke="${c.outline}" stroke-width="7" stroke-linecap="round"/>
       <path d="M7 2 Q12 14 6 24 Q1 34 8 46" fill="none" stroke="${d.jelly}" stroke-width="3.5" stroke-linecap="round"/>`,
    ),
    // Неправильный куб: грани не сходятся, один глаз.
    art(
      'cube_body',
      78,
      78,
      `
      <path d="M8 22 L42 6 L74 20 L40 36 Z" fill="${c.violetLight}" ${stroke()}/>
      <path d="M8 22 L40 36 L38 74 L6 58 Z" fill="${c.violet}" ${stroke()}/>
      <path d="M40 36 L74 20 L72 56 L38 74 Z" fill="${c.violetShade}" ${stroke()}/>
      <path d="M72 56 L60 50 L62 30" fill="none" stroke="${c.bioCyan}" stroke-width="3"/>
      ${eye(22, 46, 9)}
      `,
    ),
    // Жрец глубин: рыбья голова, высокая митра, балахон.
    art(
      'priest_body',
      78,
      102,
      `
      <path d="M14 46 Q38 38 62 46 L72 100 Q38 106 4 100 Z" fill="${d.deep}" ${stroke()}/>
      <path d="M38 46 L38 100 M18 70 L58 70" stroke="${c.amber}" stroke-width="4"/>
      <path d="M16 44 Q12 22 40 18 Q66 20 66 40 Q64 52 40 52 Q20 52 16 44 Z" fill="${c.fish}" ${stroke()}/>
      <path d="M22 14 L38 0 L56 14 L52 22 L26 22 Z" fill="${c.amber}" ${stroke(3)}/>
      <path d="M38 4 L38 18" stroke="${c.amberShade}" stroke-width="3"/>
      ${eye(50, 32, 6)}
      <path d="M58 44 Q66 44 66 38" fill="none" ${stroke(3)}/>
      `,
    ),
    art(
      'priest_leg',
      20,
      26,
      `<rect x="6" y="1" width="9" height="16" rx="4" fill="${c.fishShade}" ${stroke(3)}/>
       <path d="M2 24 Q3 16 10 16 Q18 16 19 24 Z" fill="${c.fishShade}" ${stroke(3)}/>`,
    ),
    art(
      'priest_staff',
      24,
      116,
      `<rect x="9" y="22" width="6" height="92" rx="3" fill="${c.wood}" ${stroke(3)}/>
       <circle cx="12" cy="14" r="10" fill="${c.bioCyan}" ${stroke(3)}/>
       <circle cx="9" cy="11" r="3" fill="${c.white}"/>`,
    ),

    // --- Боссы ---
    // Хранитель Рифа: огромный краб-риф с коралловым панцирем.
    art(
      'reef_body',
      240,
      170,
      `
      <path d="M12 120 Q4 60 50 36 Q120 4 190 36 Q236 60 228 120 Q200 160 120 162 Q40 160 12 120 Z" fill="${c.coral}" ${stroke(5)}/>
      <path d="M22 124 Q120 170 218 124 Q200 156 120 158 Q40 156 22 124 Z" fill="${c.coralShade}"/>
      <path d="M50 70 Q60 50 72 64 M92 46 Q104 26 116 44 M150 50 Q164 30 176 48" fill="none" stroke="${c.seaGreen}" stroke-width="7" stroke-linecap="round"/>
      <circle cx="70" cy="110" r="8" fill="${c.parchment}" ${stroke(3)}/><circle cx="96" cy="128" r="6" fill="${c.parchment}" ${stroke(3)}/>
      <circle cx="130" cy="120" r="7" fill="${c.parchment}" ${stroke(3)}/>
      <rect x="146" y="4" width="10" height="40" rx="5" fill="${c.coralShade}" ${stroke(3)}/>
      <rect x="182" y="10" width="10" height="38" rx="5" fill="${c.coralShade}" ${stroke(3)}/>
      ${eye(151, 18, 16)}${eye(187, 24, 13)}
      <path d="M170 92 Q186 102 200 92" fill="none" ${stroke(4)}/>
      `,
    ),
    art(
      'reef_claw',
      96,
      74,
      `<path d="M6 40 Q10 12 44 8 Q84 4 92 28 L58 36 L90 48 Q82 70 46 68 Q10 66 6 40 Z" fill="${c.coral}" ${stroke(5)}/>
       <path d="M14 48 Q44 64 80 56" fill="none" stroke="${c.coralShade}" stroke-width="6"/>`,
    ),
    art(
      'reef_leg',
      26,
      62,
      `<path d="M8 2 L18 2 L22 40 L14 60 L6 40 Z" fill="${c.coralShade}" ${stroke(4)}/>`,
    ),
    // Мать-Корневище: пень-гигант с короной ветвей и корнями-щупальцами.
    art(
      'mother_body',
      220,
      200,
      `
      <path d="M30 196 Q16 120 30 60 Q50 10 110 8 Q170 10 190 60 Q204 120 190 196 Z" fill="${f.bark}" ${stroke(5)}/>
      <path d="M50 196 Q56 120 70 70 M110 196 Q110 120 112 40 M170 196 Q164 120 152 70" fill="none" stroke="${f.barkShade}" stroke-width="7"/>
      ${eye(76, 76, 16)}${eye(130, 62, 21)}${eye(172, 88, 12)}
      <path d="M86 140 Q112 158 140 140" fill="none" ${stroke(5)}/>
      <circle cx="44" cy="160" r="8" fill="${f.shroom}" ${stroke(3)}/><circle cx="180" cy="150" r="6" fill="${f.glow}" ${stroke(3)}/>
      `,
    ),
    art(
      'mother_crown',
      270,
      112,
      `
      <path d="M20 106 Q10 60 50 50 Q60 10 110 18 Q140 0 170 20 Q220 10 228 54 Q266 66 252 106 Z" fill="${f.moss}" ${stroke(5)}/>
      <path d="M40 104 Q90 80 130 98 Q180 80 240 104" fill="none" stroke="${f.mossShade}" stroke-width="8"/>
      <circle cx="70" cy="46" r="7" fill="${f.glow}"/><circle cx="150" cy="30" r="8" fill="${f.glow}"/>
      <circle cx="210" cy="56" r="6" fill="${f.glow}"/>
      `,
    ),
    art(
      'mother_root',
      44,
      112,
      `<path d="M22 2 Q34 30 24 56 Q14 82 26 108" fill="none" stroke="${c.outline}" stroke-width="20" stroke-linecap="round"/>
       <path d="M22 2 Q34 30 24 56 Q14 82 26 108" fill="none" stroke="${f.barkShade}" stroke-width="13" stroke-linecap="round"/>`,
    ),
    // Великий Спящий: парящая голова с бородой щупалец; веки полуприкрыты.
    art(
      'sleeper_head',
      260,
      200,
      `
      <path d="M14 130 Q6 40 130 20 Q254 40 246 130 Q230 196 130 196 Q30 196 14 130 Z" fill="${d.deep}" ${stroke(5)}/>
      <path d="M40 60 Q130 0 220 60" fill="none" stroke="${c.violetLight}" stroke-width="6" opacity="0.6"/>
      <path d="M70 34 L82 4 L96 30 M120 22 L130 0 L142 22 M166 30 L180 4 L190 34" fill="${c.amber}" ${stroke(4)}/>
      ${eye(90, 112, 24)}${eye(170, 112, 24)}
      <path d="M64 104 Q90 84 116 104 L116 98 Q90 78 64 98 Z" fill="${c.violetShade}" ${stroke(4)}/>
      <path d="M144 104 Q170 84 196 104 L196 98 Q170 78 144 98 Z" fill="${c.violetShade}" ${stroke(4)}/>
      <circle cx="40" cy="150" r="6" fill="${c.bioCyan}"/><circle cx="222" cy="146" r="7" fill="${c.bioCyan}"/>
      `,
    ),
    art(
      'sleeper_tentacle',
      36,
      132,
      `<path d="M18 2 Q30 36 16 70 Q4 104 20 128" fill="none" stroke="${c.outline}" stroke-width="22" stroke-linecap="round"/>
       <path d="M18 2 Q30 36 16 70 Q4 104 20 128" fill="none" stroke="${c.violet}" stroke-width="15" stroke-linecap="round"/>
       <circle cx="22" cy="40" r="3" fill="${c.bioCyan}"/><circle cx="12" cy="80" r="3" fill="${c.bioCyan}"/>`,
    ),
    art(
      'sleeper_wing',
      120,
      90,
      `<path d="M6 84 Q10 20 60 6 Q110 0 116 30 Q90 30 92 50 Q66 46 70 66 Q40 62 40 84 Q24 76 6 84 Z" fill="${c.violetShade}" ${stroke(4)}/>`,
    ),

    // Волны боссов: летят по земле к герою — перепрыгнуть.
    art(
      'wave_reef',
      60,
      52,
      `<path d="M4 50 Q4 18 30 8 Q52 2 56 20 Q40 14 34 26 Q46 30 50 50 Z" fill="${c.bioCyan}" ${stroke(4)}/>
       <path d="M14 46 Q16 28 30 20" fill="none" stroke="${c.white}" stroke-width="4" opacity="0.8"/>`,
    ),
    art(
      'wave_root',
      64,
      60,
      `<path d="M6 58 L18 18 L26 40 L34 4 L44 36 L52 20 L58 58 Z" fill="${f.barkShade}" ${stroke(4)}/>
       <circle cx="34" cy="12" r="4" fill="${f.glow}"/>`,
    ),
    art(
      'wave_deep',
      68,
      58,
      `<path d="M4 56 Q8 20 34 6 Q60 20 64 56 Z" fill="${c.violet}" ${stroke(4)}/>
       <path d="M18 50 Q22 28 34 18 Q46 28 50 50" fill="none" stroke="${c.bioCyan}" stroke-width="4"/>`,
    ),

    // --- Препятствия леса ---
    art(
      'stump',
      72,
      74,
      `<path d="M8 72 L12 18 Q36 8 60 18 L64 72 Z" fill="${f.bark}" ${stroke()}/>
       <ellipse cx="36" cy="18" rx="24" ry="9" fill="#C9A06A" ${stroke(3)}/>
       <ellipse cx="36" cy="18" rx="12" ry="4" fill="none" stroke="${f.barkShade}" stroke-width="2"/>
       <path d="M20 40 L22 70 M46 36 L48 70" stroke="${f.barkShade}" stroke-width="4"/>`,
    ),
    art(
      'mushroomRing',
      118,
      46,
      `${[10, 34, 60, 86]
        .map(
          (
            x,
            i,
          ) => `<rect x="${x + 8}" y="${22 + (i % 2) * 4}" width="8" height="22" rx="3" fill="${c.parchment}" ${stroke(3)}/>
       <path d="M${x} ${26 + (i % 2) * 4} Q${x + 12} ${4 + (i % 2) * 6} ${x + 24} ${26 + (i % 2) * 4} Z" fill="${f.shroom}" ${stroke(3)}/>`,
        )
        .join('')}`,
    ),
    art(
      'thornBush',
      84,
      94,
      `<path d="M6 92 Q2 50 20 34 Q24 6 44 8 Q66 4 70 30 Q86 46 80 92 Z" fill="${f.mossShade}" ${stroke()}/>
       <path d="M18 40 L8 32 M66 32 L78 22 M40 12 L40 0 M74 62 L84 58 M10 66 L0 64" ${stroke(3)}/>
       <circle cx="34" cy="50" r="4" fill="${c.coral}"/><circle cx="56" cy="66" r="4" fill="${c.coral}"/>`,
    ),
    // --- Препятствия затонувшего города ---
    art(
      'brokenColumn',
      64,
      102,
      `<path d="M10 100 L12 26 L20 18 L30 26 L40 12 L52 22 L54 100 Z" fill="${d.stone}" ${stroke()}/>
       <path d="M22 30 L22 98 M42 26 L42 98" stroke="${d.stoneShade}" stroke-width="5"/>
       <rect x="4" y="90" width="56" height="10" rx="2" fill="${d.stoneShade}" ${stroke(3)}/>`,
    ),
    art(
      'shellPile',
      114,
      48,
      `<path d="M4 46 Q8 20 30 18 Q40 4 58 10 Q76 2 88 16 Q108 18 110 46 Z" fill="${d.coralPink}" ${stroke()}/>
       <path d="M20 46 Q24 30 34 26 M54 46 Q56 26 64 18 M88 46 Q86 30 92 24" fill="none" stroke="${c.coralShade}" stroke-width="3"/>
       <circle cx="72" cy="34" r="5" fill="${c.parchment}" ${stroke(2)}/>`,
    ),
    art(
      'idolHead',
      88,
      82,
      `<path d="M8 80 L10 26 Q12 6 44 4 Q76 6 78 26 L80 80 Z" fill="${d.stone}" ${stroke()}/>
       <path d="M22 34 Q30 28 38 34 M50 34 Q58 28 66 34" fill="none" ${stroke(4)}/>
       <path d="M30 58 Q44 66 58 58" fill="none" ${stroke(4)}/>
       <path d="M10 70 L80 70" stroke="${d.stoneShade}" stroke-width="5"/>
       <circle cx="44" cy="16" r="4" fill="${c.bioCyan}"/>`,
    ),
  ];
}
