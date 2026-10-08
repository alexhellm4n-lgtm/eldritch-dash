import { Rng } from '../../systems/Rng';
import { tones as c } from '../palette';
import { art, stroke, tileX, type PlaceholderArt } from './svg';

const W = 1280;
const H = 720;

/** Туманное побережье: 4 слоя параллакса + настил + туман. Все слои бесшовно тайлятся по X. */
export function coastBackgroundArt(groundY: number): PlaceholderArt[] {
  const rng = new Rng(1337);

  // Слой 0: небо, звёзды, луна.
  let stars = '';
  for (let i = 0; i < 90; i++) {
    const x = rng.next() * W;
    const y = rng.next() * 420;
    const r = 0.8 + rng.next() * 1.8;
    const color = rng.chance(0.15) ? c.bioCyan : c.parchment;
    stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" opacity="${(0.4 + rng.next() * 0.6).toFixed(2)}"/>`;
  }
  const sky = art(
    'bg_coast_layer0',
    W,
    H,
    `
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${c.nightSky}"/><stop offset="0.55" stop-color="#132A3E"/>
      <stop offset="0.7" stop-color="${c.deepTeal}"/><stop offset="1" stop-color="${c.deepTealDark}"/>
    </linearGradient>
    <radialGradient id="moonGlow"><stop offset="0" stop-color="${c.parchment}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${c.parchment}" stop-opacity="0"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${tileX(W, stars)}
    <circle cx="960" cy="150" r="150" fill="url(#moonGlow)"/>
    <circle cx="960" cy="150" r="58" fill="${c.parchment}" stroke="${c.parchmentShade}" stroke-width="3"/>
    <path d="M960 92 A58 58 0 0 1 960 208 A40 58 0 0 0 960 92 Z" fill="${c.parchmentShade}" opacity="0.6"/>
    <circle cx="940" cy="135" r="9" fill="${c.parchmentShade}"/>
    <circle cx="972" cy="172" r="6" fill="${c.parchmentShade}"/>
    `,
    1,
  );

  // Слой 1: дальние утёсы, маяк и море.
  let waves = '';
  for (let i = 0; i < 40; i++) {
    const x = rng.next() * W;
    const y = 500 + rng.next() * 200;
    const len = 20 + rng.next() * 50;
    waves += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} q${(len / 2).toFixed(0)} -5 ${len.toFixed(0)} 0" fill="none" stroke="${c.bioCyan}" stroke-width="2" opacity="${(0.15 + rng.next() * 0.3).toFixed(2)}"/>`;
  }
  const farCliffs = `
    <path d="M-20 500 L40 380 Q70 340 120 360 L190 330 Q240 320 270 350 L330 360 L360 500 Z" fill="#1C4450" stroke="#163842" stroke-width="3"/>
    <path d="M560 500 L610 420 Q650 400 700 410 L760 390 Q800 385 830 420 L870 500 Z" fill="#1C4450" stroke="#163842" stroke-width="3"/>
    <path d="M960 500 L1010 440 Q1060 425 1110 445 L1180 430 Q1230 430 1260 470 L1300 500 Z" fill="#1A404B" stroke="#163842" stroke-width="3"/>
    <path d="M200 333 L208 250 L232 250 L240 336 Z" fill="${c.parchment}" stroke="#163842" stroke-width="3"/>
    <path d="M205 290 L236 290 L238 310 L203 310 Z" fill="${c.coral}"/>
    <rect x="203" y="232" width="34" height="20" rx="3" fill="${c.amber}" stroke="#163842" stroke-width="3"/>
    <path d="M200 232 L220 214 L240 232 Z" fill="${c.coat}" stroke="#163842" stroke-width="3"/>
    <path d="M237 236 L560 180 L560 300 Z" fill="${c.amberLight}" opacity="0.12"/>
  `;
  const far = art(
    'bg_coast_layer1',
    W,
    H,
    `
    <rect x="0" y="480" width="${W}" height="${H - 480}" fill="${c.deepTealDark}"/>
    <rect x="0" y="478" width="${W}" height="4" fill="${c.fogShade}" opacity="0.5"/>
    ${tileX(W, farCliffs + waves)}
    `,
    1,
  );

  // Слой 2: городок на холме со светящимися окнами.
  const house = (x: number, y: number, w: number, h: number, roof: string): string => `
    <path d="M${x} ${y} L${x + w / 2} ${y - h * 0.55} L${x + w} ${y} Z" fill="${roof}" ${stroke(3)}/>
    <rect x="${x + 4}" y="${y}" width="${w - 8}" height="${h}" fill="#1E4A4E" ${stroke(3)}/>
    <rect x="${x + w * 0.3}" y="${y + h * 0.25}" width="${w * 0.18}" height="${h * 0.22}" fill="${c.amber}" ${stroke(2)}/>
    <rect x="${x + w * 0.58}" y="${y + h * 0.25}" width="${w * 0.14}" height="${h * 0.22}" fill="${c.amberShade}" ${stroke(2)}/>`;
  const town = `
    <path d="M-40 ${H} L-40 540 Q80 470 220 500 Q330 520 420 490 Q520 460 640 505 Q760 545 880 500 Q1000 460 1120 495 Q1220 525 1320 520 L1320 ${H} Z"
      fill="#143A3E" ${stroke(3)}/>
    ${house(70, 470, 70, 50, c.coral)}${house(150, 485, 56, 40, c.violetShade)}
    ${house(470, 455, 80, 56, c.violetShade)}${house(560, 470, 60, 44, c.coralShade)}
    ${house(900, 460, 72, 52, c.coral)}${house(990, 478, 54, 40, c.violetShade)}
  `;
  const mid = art('bg_coast_layer2', W, H, tileX(W, town), 1);

  // Слой 3: сваи причала, камни, водоросли.
  const post = (x: number, h: number): string => `
    <rect x="${x}" y="${groundY - h}" width="22" height="${h + 20}" rx="4" fill="${c.woodShade}" ${stroke()}/>
    <path d="M${x - 2} ${groundY - h + 18} L${x + 24} ${groundY - h + 24}" ${stroke(3)}/>`;
  const rock = (x: number, w: number, h: number): string => `
    <path d="M${x} ${groundY + 10} Q${x + 4} ${groundY - h} ${x + w * 0.45} ${groundY - h} Q${x + w} ${groundY - h * 0.8} ${x + w} ${groundY + 10} Z"
      fill="${c.seaGreenShade}" ${stroke()}/>
    <path d="M${x + w * 0.5} ${groundY - h + 4} Q${x + w * 0.9} ${groundY - h * 0.7} ${x + w - 4} ${groundY + 6} L${x + w * 0.6} ${groundY + 6} Z" fill="#1A4A42"/>`;
  const weed = (x: number): string =>
    `<path d="M${x} ${groundY} Q${x - 10} ${groundY - 30} ${x + 4} ${groundY - 60} M${x + 8} ${groundY} Q${x + 18} ${groundY - 26} ${x + 10} ${groundY - 46}"
      fill="none" stroke="${c.seaGreen}" stroke-width="5" stroke-linecap="round"/>`;
  const near = art(
    'bg_coast_layer3',
    W,
    H,
    tileX(
      W,
      `${post(120, 150)}${post(420, 120)}${post(860, 170)}${rock(220, 140, 70)}${rock(640, 110, 50)}
       ${rock(1040, 170, 90)}${weed(370)}${weed(780)}${weed(1210)}
       <path d="M131 ${groundY - 120} Q280 ${groundY - 60} 431 ${groundY - 95}" fill="none" stroke="${c.rope}" stroke-width="4"/>`,
    ),
    1,
  );

  // Настил: доски сверху, тёмный песок снизу. Верх текстуры = уровень земли.
  let planks = '';
  for (let x = 0; x < W; x += 80) {
    planks += `<path d="M${x} 4 L${x} 30" ${stroke(3)}/><circle cx="${x + 8}" cy="12" r="2" fill="${c.outline}"/><circle cx="${x + 72}" cy="22" r="2" fill="${c.outline}"/>`;
  }
  let pebbles = '';
  for (let i = 0; i < 40; i++) {
    pebbles += `<ellipse cx="${(rng.next() * W).toFixed(0)}" cy="${(46 + rng.next() * 70).toFixed(0)}" rx="${(3 + rng.next() * 6).toFixed(0)}" ry="3" fill="#25414A"/>`;
  }
  const ground = art(
    'ground_coast',
    W,
    H - groundY,
    `
    <rect x="0" y="0" width="${W}" height="${H - groundY}" fill="#1B3138"/>
    ${tileX(W, pebbles)}
    <rect x="-10" y="2" width="${W + 20}" height="30" fill="${c.wood}" ${stroke()}/>
    <rect x="-10" y="20" width="${W + 20}" height="12" fill="${c.woodShade}"/>
    <path d="M-10 32 L${W + 10} 32" ${stroke()}/>
    ${planks}
    `,
    1,
  );

  // Туман: размытые овалы.
  let blobs = '';
  for (let i = 0; i < 14; i++) {
    blobs += `<ellipse cx="${(rng.next() * W).toFixed(0)}" cy="${(80 + rng.next() * 80).toFixed(0)}" rx="${(120 + rng.next() * 160).toFixed(0)}" ry="${(30 + rng.next() * 30).toFixed(0)}" fill="${c.fog}" opacity="${(0.12 + rng.next() * 0.16).toFixed(2)}"/>`;
  }
  const fog = art(
    'fog_coast',
    W,
    240,
    `<defs><filter id="b" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="14"/></filter></defs>
     <g filter="url(#b)">${tileX(W, blobs)}</g>`,
    1,
  );

  return [sky, far, mid, near, ground, fog];
}
