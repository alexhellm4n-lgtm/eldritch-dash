import { tones as c } from '../palette';
import { art, stroke, type PlaceholderArt } from './svg';

/** Эдгар-библиотекарь: голова в очках, сюртук, ноги, рука, фонарь и крылья-плащ. */
export function heroArt(): PlaceholderArt[] {
  return [
    art(
      'hero_head',
      62,
      60,
      `
      <path d="M14 22 Q12 6 30 5 Q44 4 50 14 Q40 10 34 14 Q26 8 20 16 Z" fill="#3B2A4A" ${stroke(3)}/>
      <circle cx="32" cy="32" r="24" fill="${c.skin}" ${stroke()}/>
      <path d="M14 44 Q30 58 50 44 Q46 54 32 55 Q18 54 14 44 Z" fill="${c.skinShade}"/>
      <circle cx="32" cy="32" r="24" fill="none" ${stroke()}/>
      <path d="M10 22 Q14 8 30 8 Q44 7 52 18 Q42 14 36 18 Q28 12 22 20 Q16 18 10 22 Z" fill="#3B2A4A" ${stroke(3)}/>
      <ellipse cx="13" cy="34" rx="5" ry="7" fill="${c.skinShade}" ${stroke(3)}/>
      <circle cx="38" cy="31" r="9" fill="${c.white}" ${stroke(3)}/>
      <circle cx="53" cy="31" r="7" fill="${c.white}" ${stroke(3)}/>
      <path d="M47 31 L46 31" ${stroke(3)}/>
      <circle cx="40" cy="32" r="3.6" fill="${c.outline}"/>
      <circle cx="54" cy="32" r="3" fill="${c.outline}"/>
      <circle cx="41.2" cy="30.6" r="1.2" fill="${c.white}"/>
      <path d="M41 46 Q46 48 50 44" fill="none" ${stroke(3)}/>
      `,
    ),
    art(
      'hero_body',
      46,
      48,
      `
      <path d="M8 6 Q23 0 38 6 L42 44 Q23 48 4 44 Z" fill="${c.coat}" ${stroke()}/>
      <path d="M23 3 L42 44 Q30 47 23 46 Z" fill="${c.coatShade}"/>
      <path d="M17 5 L23 22 L29 5" fill="${c.parchment}" ${stroke(3)}/>
      <path d="M21 22 L23 40" ${stroke(2)}/>
      <circle cx="27" cy="28" r="2" fill="${c.amber}"/>
      <circle cx="27" cy="36" r="2" fill="${c.amber}"/>
      <path d="M8 6 Q23 0 38 6 L42 44 Q23 48 4 44 Z" fill="none" ${stroke()}/>
      `,
    ),
    art(
      'hero_leg',
      22,
      30,
      `
      <rect x="6" y="2" width="10" height="20" rx="4" fill="${c.coatShade}" ${stroke(3)}/>
      <path d="M4 22 Q4 18 10 18 L16 18 Q21 19 21 24 L21 27 L4 27 Z" fill="${c.wood}" ${stroke(3)}/>
      `,
    ),
    art(
      'hero_arm',
      18,
      32,
      `
      <rect x="4" y="2" width="11" height="24" rx="5" fill="${c.coat}" ${stroke(3)}/>
      <circle cx="9.5" cy="27" r="5" fill="${c.skin}" ${stroke(3)}/>
      `,
    ),
    art(
      'hero_lantern',
      30,
      42,
      `
      <path d="M9 10 Q15 -1 21 10" fill="none" ${stroke(3)}/>
      <rect x="6" y="9" width="18" height="6" rx="2" fill="${c.wood}" ${stroke(3)}/>
      <path d="M7 15 L23 15 L25 33 L5 33 Z" fill="${c.amberLight}" ${stroke(3)}/>
      <path d="M15 15 L23 15 L25 33 L15 33 Z" fill="${c.amber}"/>
      <path d="M15 19 Q11 25 15 29 Q19 25 15 19 Z" fill="${c.white}"/>
      <path d="M7 15 L23 15 L25 33 L5 33 Z" fill="none" ${stroke(3)}/>
      <rect x="4" y="33" width="22" height="6" rx="2" fill="${c.wood}" ${stroke(3)}/>
      `,
    ),
    art(
      'hero_wing',
      50,
      74,
      `
      <path d="M20 4 Q34 6 40 18 L46 62 Q38 56 33 66 Q27 58 21 70 Q16 60 8 66 Q12 40 10 20 Q12 6 20 4 Z"
        fill="${c.violet}" ${stroke()}/>
      <path d="M26 10 Q32 30 33 64 Q27 58 21 70 Q20 40 18 14 Z" fill="${c.violetShade}"/>
      <path d="M20 8 L33 64 M20 8 L20 68 M20 8 L10 60" fill="none" stroke="${c.violetLight}" stroke-width="2"/>
      <path d="M20 4 Q34 6 40 18 L46 62 Q38 56 33 66 Q27 58 21 70 Q16 60 8 66 Q12 40 10 20 Q12 6 20 4 Z"
        fill="none" ${stroke()}/>
      `,
    ),
  ];
}
