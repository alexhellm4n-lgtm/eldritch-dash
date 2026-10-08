import { tones as c } from '../palette';
import { art, stroke, type PlaceholderArt } from './svg';

/** Твари побережья: милые и нелепые, а не страшные (SPEC §8.1). */
export function enemyArt(): PlaceholderArt[] {
  return [
    // Общие глаза и сегмент щупальца (тонируется под тварь).
    art('eye', 24, 24, `<circle cx="12" cy="12" r="9.5" fill="${c.white}" ${stroke(3)}/>`),
    art(
      'pupil',
      12,
      12,
      `<circle cx="6" cy="6" r="4.5" fill="${c.outline}"/><circle cx="7.5" cy="4.5" r="1.4" fill="${c.white}"/>`,
    ),
    art('seg', 22, 22, `<circle cx="11" cy="11" r="8.5" fill="${c.white}" ${stroke(3)}/>`),

    // Рыболюд-матрос
    art(
      'fish_head',
      70,
      60,
      `
      <path d="M8 36 Q6 12 34 10 Q58 10 64 32 Q66 50 40 54 Q14 56 8 36 Z" fill="${c.fish}" ${stroke()}/>
      <path d="M12 44 Q30 56 56 44 Q50 54 36 54 Q18 54 12 44 Z" fill="${c.fishShade}"/>
      <path d="M8 36 Q6 12 34 10 Q58 10 64 32 Q66 50 40 54 Q14 56 8 36 Z" fill="none" ${stroke()}/>
      <path d="M16 30 Q12 36 16 42 M22 28 Q18 36 22 44" fill="none" stroke="${c.fishShade}" stroke-width="3" stroke-linecap="round"/>
      <path d="M18 14 Q22 2 36 3 Q50 2 54 14 Z" fill="${c.parchment}" ${stroke(3)}/>
      <rect x="16" y="12" width="40" height="6" rx="3" fill="${c.deepTeal}" ${stroke(3)}/>
      <path d="M52 44 Q60 44 62 38" fill="none" ${stroke(3)}/>
      `,
    ),
    art(
      'fish_body',
      58,
      56,
      `
      <path d="M8 6 Q29 0 50 6 L54 50 Q29 56 4 50 Z" fill="${c.parchment}" ${stroke()}/>
      <path d="M6 18 L52 18 M5 30 L53 30 M4 42 L54 42" stroke="${c.deepTeal}" stroke-width="5"/>
      <path d="M8 6 Q29 0 50 6 L54 50 Q29 56 4 50 Z" fill="none" ${stroke()}/>
      <path d="M22 4 L29 14 L36 4" fill="${c.coral}" ${stroke(3)}/>
      `,
    ),
    art(
      'fish_leg',
      22,
      30,
      `
      <rect x="6" y="2" width="10" height="18" rx="4" fill="${c.fish}" ${stroke(3)}/>
      <path d="M2 26 Q4 18 11 18 Q20 18 21 26 Q16 23 13 27 Q10 23 6 27 Q4 24 2 26 Z" fill="${c.fishShade}" ${stroke(3)}/>
      `,
    ),

    // Чайка с щупальцем
    art(
      'gull_body',
      90,
      52,
      `
      <path d="M10 28 Q14 10 44 10 Q70 10 74 24 L86 26 L74 32 Q68 46 42 46 Q16 46 10 28 Z" fill="${c.gull}" ${stroke()}/>
      <path d="M14 34 Q40 50 70 36 Q62 46 42 46 Q20 46 14 34 Z" fill="${c.gullShade}"/>
      <path d="M10 28 Q14 10 44 10 Q70 10 74 24 L86 26 L74 32 Q68 46 42 46 Q16 46 10 28 Z" fill="none" ${stroke()}/>
      <path d="M72 24 L88 27 L72 32 Z" fill="${c.amber}" ${stroke(3)}/>
      <path d="M10 28 L2 22 L4 32 Z" fill="${c.gullShade}" ${stroke(3)}/>
      `,
    ),
    art(
      'gull_wing',
      56,
      34,
      `
      <path d="M4 26 Q12 4 50 6 Q40 14 44 18 Q34 18 36 24 Q24 22 22 30 Q12 28 4 26 Z" fill="${c.gullShade}" ${stroke()}/>
      <path d="M40 8 Q46 7 50 6 Q42 12 44 18 Z" fill="${c.outline}"/>
      `,
    ),

    // Кальмарёнок
    art(
      'squid_mantle',
      64,
      62,
      `
      <path d="M32 4 Q56 8 58 34 Q60 54 32 56 Q4 54 6 34 Q8 8 32 4 Z" fill="${c.coral}" ${stroke()}/>
      <path d="M36 6 Q56 10 58 34 Q60 54 32 56 Q48 40 36 6 Z" fill="${c.coralShade}"/>
      <path d="M32 4 Q56 8 58 34 Q60 54 32 56 Q4 54 6 34 Q8 8 32 4 Z" fill="none" ${stroke()}/>
      <circle cx="18" cy="18" r="4" fill="${c.coralShade}"/>
      <circle cx="28" cy="12" r="3" fill="${c.coralShade}"/>
      <circle cx="46" cy="20" r="3.5" fill="${c.parchment}" opacity="0.6"/>
      `,
    ),

    // Ходячая сеть (бронированная)
    art(
      'net_body',
      96,
      90,
      `
      <path d="M12 52 Q6 20 30 10 Q52 2 72 12 Q92 24 88 54 Q86 82 50 84 Q14 84 12 52 Z" fill="${c.rope}" ${stroke()}/>
      <path d="M20 66 Q50 84 86 58 Q84 82 50 84 Q22 84 20 66 Z" fill="${c.ropeShade}"/>
      <g fill="none" stroke="${c.ropeShade}" stroke-width="3">
        <path d="M14 30 L84 70 M22 18 L88 50 M40 8 L86 34 M12 52 L66 82 M24 74 L36 82"/>
        <path d="M84 30 L14 70 M74 14 L12 48 M56 8 L22 22 M88 52 L40 84 M80 72 L70 80"/>
      </g>
      <path d="M12 52 Q6 20 30 10 Q52 2 72 12 Q92 24 88 54 Q86 82 50 84 Q14 84 12 52 Z" fill="none" ${stroke()}/>
      <circle cx="26" cy="20" r="7" fill="${c.coral}" ${stroke(3)}/>
      <circle cx="80" cy="40" r="7" fill="${c.amber}" ${stroke(3)}/>
      <path d="M30 80 Q26 88 32 92 M60 82 Q66 90 60 94" fill="none" stroke="${c.seaGreen}" stroke-width="4" stroke-linecap="round"/>
      `,
    ),
  ];
}
