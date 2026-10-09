import { Rng } from '../../systems/Rng';
import { tones as c } from '../palette';
import { art, stroke, type PlaceholderArt } from './svg';

const W = 1280;
const H = 720;

/** Окна, которые загораются с уровнем постройки (рисуются поверх тёмными, свет — в сцене). */
const window = (x: number, y: number, w: number, h: number): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${c.amber}" ${stroke(2.5)}/>`;

/** Городок на утёсе (SPEC §6): фон, шесть построек и пустой участок. */
export function townArt(): PlaceholderArt[] {
  const rng = new Rng(777);
  let stars = '';
  for (let i = 0; i < 70; i++) {
    stars += `<circle cx="${(rng.next() * W).toFixed(0)}" cy="${(rng.next() * 330).toFixed(0)}" r="${(0.8 + rng.next() * 1.6).toFixed(1)}" fill="${c.parchment}" opacity="${(0.3 + rng.next() * 0.6).toFixed(2)}"/>`;
  }
  let waves = '';
  for (let i = 0; i < 30; i++) {
    const x = 700 + rng.next() * 580;
    const y = 520 + rng.next() * 190;
    waves += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} q14 -5 28 0" fill="none" stroke="${c.bioCyan}" stroke-width="2" opacity="${(0.15 + rng.next() * 0.3).toFixed(2)}"/>`;
  }
  const bg = art(
    'town_bg',
    W,
    H,
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.nightSky}"/><stop offset="0.6" stop-color="#16304A"/><stop offset="1" stop-color="${c.deepTeal}"/>
    </linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${stars}
    <circle cx="860" cy="96" r="48" fill="${c.parchment}" stroke="${c.parchmentShade}" stroke-width="3"/>
    <rect x="0" y="500" width="${W}" height="${H - 500}" fill="${c.deepTealDark}"/>
    ${waves}
    <path d="M-20 ${H} L-20 430 Q80 400 200 420 Q320 440 420 452 Q560 470 700 486 Q780 492 820 520 L860 560 Q900 560 940 520
      L980 380 Q1010 350 1060 352 Q1120 356 1150 400 L1180 560 Q1200 640 1260 ${H} Z" fill="#2B3A35" ${stroke(4)}/>
    <path d="M-20 470 Q200 470 400 500 Q600 520 820 560 L860 600 Q900 600 960 560 L1000 420 Q1060 400 1140 430 L1180 600 L1220 ${H} L-20 ${H} Z" fill="#22302B"/>
    <path d="M60 600 Q120 590 170 610 M300 620 Q360 600 420 630 M560 640 Q620 620 680 650" fill="none" stroke="#33473F" stroke-width="5"/>
    <path d="M150 440 Q300 470 450 480 Q600 500 760 520" fill="none" stroke="${c.rope}" stroke-width="4" stroke-dasharray="10 8" opacity="0.6"/>`,
    1,
  );

  const lighthouse = art(
    'town_lighthouse',
    96,
    240,
    `<path d="M22 236 L32 70 L64 70 L74 236 Z" fill="${c.parchment}" ${stroke()}/>
     <path d="M26 170 L70 170 L72 200 L24 200 Z M30 110 L66 110 L68 136 L28 136 Z" fill="${c.coral}"/>
     <path d="M22 236 L32 70 L64 70 L74 236 Z" fill="none" ${stroke()}/>
     <rect x="26" y="40" width="44" height="32" rx="4" fill="#2B2238" ${stroke()}/>
     ${window(34, 46, 28, 20)}
     <path d="M20 42 L48 12 L76 42 Z" fill="${c.coat}" ${stroke()}/>
     <circle cx="48" cy="10" r="5" fill="${c.amber}" ${stroke(2.5)}/>
     <rect x="14" y="72" width="68" height="8" rx="3" fill="${c.coatShade}" ${stroke(3)}/>
     <path d="M40 236 L40 214 Q48 206 56 214 L56 236" fill="${c.woodShade}" ${stroke(3)}/>`,
  );
  const chapel = art(
    'town_chapel',
    124,
    160,
    `<path d="M14 156 L14 72 L62 40 L110 72 L110 156 Z" fill="#6E7FA0" ${stroke()}/>
     <path d="M48 46 L62 2 L76 46 Z" fill="${c.violetShade}" ${stroke()}/>
     <path d="M56 12 L68 12" ${stroke(3)}/>
     <path d="M6 76 L62 34 L118 76 L110 80 L62 46 L14 80 Z" fill="${c.violetShade}" ${stroke()}/>
     <path d="M50 156 L50 120 Q62 104 74 120 L74 156 Z" fill="${c.woodShade}" ${stroke(3)}/>
     <circle cx="62" cy="88" r="12" fill="${c.amber}" ${stroke(3)}/>
     <path d="M62 76 L62 100 M50 88 L74 88" stroke="${c.outline}" stroke-width="2.5"/>
     ${window(24, 100, 14, 22)}${window(86, 100, 14, 22)}`,
  );
  const archive = art(
    'town_archive',
    148,
    126,
    `<rect x="12" y="44" width="124" height="80" fill="#8A6A4A" ${stroke()}/>
     <path d="M4 48 L74 8 L144 48 Z" fill="${c.coralShade}" ${stroke()}/>
     <path d="M30 52 L30 120 M118 52 L118 120" stroke="${c.parchment}" stroke-width="8"/>
     <path d="M62 124 L62 92 L86 92 L86 124" fill="${c.woodShade}" ${stroke(3)}/>
     ${window(40, 60, 18, 20)}${window(90, 60, 18, 20)}
     <rect x="54" y="26" width="40" height="12" rx="3" fill="${c.parchment}" ${stroke(2.5)}/>
     <path d="M60 32 L88 32" stroke="${c.outline}" stroke-width="2"/>`,
  );
  const observatory = art(
    'town_observatory',
    136,
    156,
    `<rect x="22" y="78" width="92" height="76" fill="#5C6E86" ${stroke()}/>
     <path d="M16 82 Q16 20 68 20 Q120 20 120 82 Z" fill="#8FA3BE" ${stroke()}/>
     <path d="M62 22 L74 22 L74 82 L62 82 Z" fill="#2B2238"/>
     <path d="M70 52 L118 8" stroke="${c.rope}" stroke-width="10" stroke-linecap="round"/>
     <path d="M70 52 L118 8" fill="none" ${stroke(3)}/>
     <circle cx="120" cy="6" r="5" fill="${c.bioCyan}"/>
     ${window(34, 98, 16, 20)}${window(86, 98, 16, 20)}
     <path d="M56 154 L56 124 L80 124 L80 154" fill="${c.woodShade}" ${stroke(3)}/>`,
  );
  const fishMarket = art(
    'town_fishMarket',
    156,
    108,
    `<rect x="12" y="44" width="132" height="62" fill="${c.wood}" ${stroke()}/>
     ${[0, 1, 2, 3, 4, 5]
       .map(
         (i) =>
           `<path d="M${6 + i * 24} 46 L${6 + i * 24} 22 L${30 + i * 24} 22 L${30 + i * 24} 46 Q${18 + i * 24} 56 ${6 + i * 24} 46 Z" fill="${i % 2 ? c.parchment : c.coral}" ${stroke(3)}/>`,
       )
       .join('')}
     <rect x="24" y="72" width="108" height="16" rx="3" fill="${c.woodShade}" ${stroke(3)}/>
     <path d="M34 72 Q42 62 52 70 L48 74 Z M70 72 Q80 60 92 70 L88 74 Z M104 72 Q112 64 122 70 L118 74 Z" fill="${c.fish}" ${stroke(2)}/>
     ${window(110, 52, 18, 14)}`,
  );
  const greenhouse = art(
    'town_greenhouse',
    148,
    118,
    `<path d="M10 116 L10 60 Q74 0 138 60 L138 116 Z" fill="${c.bioCyan}" opacity="0.35" ${stroke()}/>
     <path d="M10 60 Q74 0 138 60 M74 12 L74 116 M38 30 L38 116 M110 30 L110 116 M10 88 L138 88" fill="none" ${stroke(3)}/>
     <path d="M30 116 Q24 80 40 70 Q52 90 46 116 Z" fill="${c.seaGreen}" ${stroke(2.5)}/>
     <path d="M84 116 Q80 70 96 54 Q108 70 100 116 Z" fill="${c.violetLight}" ${stroke(2.5)}/>
     ${eye(96, 66)}
     <circle cx="60" cy="100" r="7" fill="${c.coral}" ${stroke(2.5)}/>
     ${window(118, 96, 12, 14)}`,
  );
  const plot = art(
    'town_plot',
    120,
    60,
    `<path d="M6 58 L114 58" ${stroke(4)}/>
     <path d="M10 58 L10 34 M38 58 L38 34 M82 58 L82 34 M110 58 L110 34 M6 40 L114 40" stroke="${c.woodShade}" stroke-width="5"/>
     <rect x="44" y="6" width="32" height="22" rx="3" fill="${c.parchment}" ${stroke(3)}/>
     <path d="M60 28 L60 58" stroke="${c.woodShade}" stroke-width="5"/>
     <path d="M52 14 L68 14 M52 20 L64 20" stroke="${c.outline}" stroke-width="2"/>`,
  );
  return [bg, lighthouse, chapel, archive, observatory, fishMarket, greenhouse, plot];
}

function eye(x: number, y: number): string {
  return `<circle cx="${x}" cy="${y}" r="6" fill="${c.white}" ${stroke(2.5)}/><circle cx="${x + 1}" cy="${y}" r="2.6" fill="${c.outline}"/>`;
}
