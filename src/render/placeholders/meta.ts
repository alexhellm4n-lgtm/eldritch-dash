import { tones as c } from '../palette';
import { art, stroke, type PlaceholderArt } from './svg';

/** Плейсхолдеры мета-систем M3: пикапы, кот, значки фаз и валют, сон, шум для искажений. */
export function metaArt(): PlaceholderArt[] {
  return [
    // Пикапы рассудка и страница книги.
    art(
      'pickup_lantern',
      40,
      50,
      `<path d="M14 8 Q20 0 26 8" fill="none" ${stroke(3)}/>
       <rect x="10" y="8" width="20" height="6" rx="2" fill="${c.wood}" ${stroke(3)}/>
       <path d="M8 14 Q20 10 32 14 L34 38 Q20 44 6 38 Z" fill="${c.coral}" ${stroke(3)}/>
       <path d="M12 18 Q20 16 28 18 L29 34 Q20 38 11 34 Z" fill="${c.amberLight}"/>
       <path d="M20 20 Q16 27 20 32 Q24 27 20 20 Z" fill="${c.white}"/>
       <rect x="12" y="40" width="16" height="6" rx="2" fill="${c.wood}" ${stroke(3)}/>`,
    ),
    art(
      'pickup_tea',
      40,
      34,
      `<path d="M14 2 Q10 6 14 10 M20 0 Q16 5 20 10" fill="none" stroke="${c.fog}" stroke-width="2.5" stroke-linecap="round"/>
       <path d="M6 12 L30 12 L27 28 Q18 32 9 28 Z" fill="${c.parchment}" ${stroke(3)}/>
       <path d="M8 14 L28 14 L27 18 L9 18 Z" fill="${c.amberShade}"/>
       <path d="M30 15 Q38 16 34 24 Q31 26 28 24" fill="none" ${stroke(3)}/>
       <ellipse cx="18" cy="31" rx="15" ry="2.5" fill="${c.parchmentShade}" ${stroke(2)}/>`,
    ),
    art(
      'pickup_page',
      44,
      48,
      `<path d="M6 4 L34 2 L38 12 L35 22 L39 32 L36 44 L8 46 L4 34 L7 24 L3 14 Z" fill="${c.parchment}" ${stroke(3)}/>
       <path d="M10 12 L30 11 M10 18 L28 17 M10 24 L31 23 M10 30 L26 30" stroke="${c.parchmentShade}" stroke-width="2.5"/>
       <circle cx="22" cy="37" r="5" fill="none" stroke="${c.violet}" stroke-width="2"/>
       <circle cx="22" cy="37" r="1.8" fill="${c.violet}"/>`,
    ),
    art(
      'coin_star',
      38,
      38,
      `<circle cx="19" cy="19" r="16" fill="${c.bioCyan}" ${stroke(3)}/>
       <path d="M19 6 L22 15 L32 15 L24 21 L27 31 L19 25 L11 31 L14 21 L6 15 L16 15 Z" fill="${c.white}" ${stroke(2)}/>`,
    ),
    art(
      'chest',
      44,
      36,
      `<rect x="4" y="14" width="36" height="20" rx="3" fill="${c.wood}" ${stroke(3)}/>
       <path d="M4 16 Q22 0 40 16 Z" fill="${c.woodShade}" ${stroke(3)}/>
       <rect x="18" y="14" width="8" height="10" rx="2" fill="${c.amber}" ${stroke(2)}/>`,
    ),

    // Кот-фамильяр: чёрный, с крошечными крыльями.
    art(
      'cat_body',
      52,
      34,
      `<path d="M6 20 Q6 6 26 6 Q46 6 46 20 Q46 30 26 30 Q6 30 6 20 Z" fill="#2B2238" ${stroke(3)}/>
       <path d="M10 28 L12 33 M20 30 L20 34 M32 30 L32 34 M42 27 L40 33" ${stroke(3)}/>`,
    ),
    art(
      'cat_head',
      38,
      36,
      `<path d="M6 12 L8 2 L16 9 L22 9 L30 2 L32 12 Q36 30 19 32 Q2 30 6 12 Z" fill="#2B2238" ${stroke(3)}/>
       <ellipse cx="13" cy="18" rx="4" ry="5" fill="${c.amberLight}"/>
       <ellipse cx="25" cy="18" rx="4" ry="5" fill="${c.amberLight}"/>
       <ellipse cx="14" cy="18" rx="1.5" ry="4" fill="${c.outline}"/>
       <ellipse cx="26" cy="18" rx="1.5" ry="4" fill="${c.outline}"/>
       <path d="M17 25 L19 27 L21 25" fill="none" stroke="${c.coral}" stroke-width="2"/>`,
    ),
    art(
      'cat_wing',
      30,
      22,
      `<path d="M2 18 Q6 2 28 4 Q22 10 24 14 Q16 12 16 18 Q8 16 2 18 Z" fill="${c.violet}" ${stroke(2.5)}/>`,
    ),
    art(
      'cat_tail',
      30,
      30,
      `<path d="M4 26 Q18 24 20 12 Q22 4 28 6" fill="none" stroke="#2B2238" stroke-width="7" stroke-linecap="round"/>
       <path d="M4 26 Q18 24 20 12 Q22 4 28 6" fill="none" stroke="${c.outline}" stroke-width="2" stroke-linecap="round"/>`,
    ),

    // Значки небесных фаз.
    art(
      'phase_quiet',
      40,
      40,
      `<circle cx="20" cy="20" r="17" fill="${c.nightSky}" ${stroke(3)}/>
       <path d="M24 9 A11 11 0 1 0 31 25 A8 8 0 1 1 24 9 Z" fill="${c.parchment}"/>
       <circle cx="12" cy="12" r="1.5" fill="${c.parchment}"/>`,
    ),
    art(
      'phase_fog',
      40,
      40,
      `<circle cx="20" cy="20" r="17" fill="${c.deepTeal}" ${stroke(3)}/>
       <path d="M8 16 Q14 12 20 16 Q26 20 32 16 M8 23 Q14 19 20 23 Q26 27 32 23 M10 30 Q16 26 22 30" fill="none" stroke="${c.fog}" stroke-width="3" stroke-linecap="round"/>`,
    ),
    art(
      'phase_bloodMoon',
      40,
      40,
      `<circle cx="20" cy="20" r="17" fill="${c.nightSky}" ${stroke(3)}/>
       <circle cx="20" cy="20" r="10" fill="${c.coral}"/>
       <circle cx="17" cy="17" r="2" fill="${c.coralShade}"/><circle cx="23" cy="23" r="1.5" fill="${c.coralShade}"/>`,
    ),
    art(
      'phase_storm',
      40,
      40,
      `<circle cx="20" cy="20" r="17" fill="${c.coat}" ${stroke(3)}/>
       <path d="M10 18 Q12 10 20 11 Q28 10 30 18 Z" fill="${c.fog}"/>
       <path d="M21 18 L15 27 L20 27 L17 34 L26 23 L21 23 L24 18 Z" fill="${c.amber}"/>`,
    ),
    art(
      'phase_aligned',
      40,
      40,
      `<circle cx="20" cy="20" r="17" fill="${c.violetShade}" ${stroke(3)}/>
       <path d="M9 26 L16 13 L24 22 L31 10" fill="none" stroke="${c.bioCyan}" stroke-width="2"/>
       <circle cx="9" cy="26" r="2.5" fill="${c.white}"/><circle cx="16" cy="13" r="2.5" fill="${c.white}"/>
       <circle cx="24" cy="22" r="2.5" fill="${c.white}"/><circle cx="31" cy="10" r="2.5" fill="${c.white}"/>`,
    ),

    // Значки валют.
    art(
      'icon_essence',
      28,
      28,
      `<path d="M14 2 Q24 12 22 18 Q20 26 14 26 Q8 26 6 18 Q4 12 14 2 Z" fill="${c.violetLight}" ${stroke(2.5)}/>
       <path d="M14 10 Q18 15 16 20" fill="none" stroke="${c.white}" stroke-width="2" stroke-linecap="round"/>`,
    ),
    art(
      'icon_sardine',
      30,
      20,
      `<path d="M3 10 Q10 2 20 6 L28 2 L26 10 L28 18 L20 14 Q10 18 3 10 Z" fill="${c.fog}" ${stroke(2.5)}/>
       <circle cx="9" cy="9" r="1.6" fill="${c.outline}"/>`,
    ),
    art(
      'icon_darkstar',
      28,
      28,
      `<path d="M14 2 L17 11 L26 11 L19 17 L22 26 L14 20 L6 26 L9 17 L2 11 L11 11 Z" fill="${c.violetShade}" ${stroke(2.5)}/>
       <circle cx="14" cy="14" r="2.5" fill="${c.bioCyan}"/>`,
    ),

    // Сновидение.
    art(
      'dream_ring',
      60,
      160,
      `<ellipse cx="30" cy="80" rx="22" ry="72" fill="none" stroke="${c.outline}" stroke-width="12"/>
       <ellipse cx="30" cy="80" rx="22" ry="72" fill="none" stroke="${c.bioCyan}" stroke-width="7"/>
       <ellipse cx="30" cy="80" rx="22" ry="72" fill="none" stroke="${c.white}" stroke-width="2" opacity="0.7"/>`,
    ),
    art(
      'dream_island',
      140,
      90,
      `<path d="M8 30 Q70 14 132 30 Q120 50 96 62 Q80 88 70 84 Q58 88 46 64 Q20 52 8 30 Z" fill="${c.violetShade}" ${stroke()}/>
       <path d="M8 30 Q70 14 132 30 Q70 40 8 30 Z" fill="${c.seaGreen}" ${stroke(3)}/>
       <circle cx="40" cy="22" r="6" fill="${c.bioCyan}" ${stroke(2)}/>
       <path d="M96 24 L100 8 L104 24" fill="${c.amberLight}" ${stroke(2)}/>`,
    ),

    // Шум для фильтра смещения (волны при низком рассудке).
    art(
      'noise_displace',
      256,
      256,
      `<defs><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.03" numOctaves="2" seed="7"/></filter></defs>
       <rect width="256" height="256" filter="url(#n)"/>`,
      1,
    ),
  ];
}
