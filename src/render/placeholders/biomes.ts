import { Rng } from '../../systems/Rng';
import { tones as c } from '../palette';
import { art, stroke, tileX, type PlaceholderArt } from './svg';

const W = 1280;
const H = 720;

/** Туман: размытые овалы заданного цвета. */
function fogArt(key: string, color: string, rng: Rng): PlaceholderArt {
  let blobs = '';
  for (let i = 0; i < 14; i++) {
    blobs += `<ellipse cx="${(rng.next() * W).toFixed(0)}" cy="${(80 + rng.next() * 80).toFixed(0)}" rx="${(120 + rng.next() * 160).toFixed(0)}" ry="${(30 + rng.next() * 30).toFixed(0)}" fill="${color}" opacity="${(0.12 + rng.next() * 0.16).toFixed(2)}"/>`;
  }
  return art(
    key,
    W,
    240,
    `<defs><filter id="b" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="14"/></filter></defs>
     <g filter="url(#b)">${tileX(W, blobs)}</g>`,
    1,
  );
}

function starsSvg(rng: Rng, n: number, maxY: number, color: string): string {
  let out = '';
  for (let i = 0; i < n; i++) {
    out += `<circle cx="${(rng.next() * W).toFixed(1)}" cy="${(rng.next() * maxY).toFixed(1)}" r="${(0.8 + rng.next() * 1.6).toFixed(1)}" fill="${color}" opacity="${(0.3 + rng.next() * 0.6).toFixed(2)}"/>`;
  }
  return out;
}

/** Гнилой лес: светящиеся грибы, кривые деревья с глазами (SPEC §7). */
export function forestBackgroundArt(groundY: number): PlaceholderArt[] {
  const rng = new Rng(4242);
  const moss = '#3E6B4A';
  const mossShade = '#2C4F37';
  const bark = '#4A3A30';
  const barkFar = '#22302A';
  const shroom = '#C0507A';
  const glow = '#B6F25C';

  const sky = art(
    'bg_forest_layer0',
    W,
    H,
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0D1218"/><stop offset="0.6" stop-color="#18261F"/><stop offset="1" stop-color="#22362A"/>
    </linearGradient>
    <radialGradient id="moon"><stop offset="0" stop-color="${glow}" stop-opacity="0.3"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${tileX(W, starsSvg(rng, 50, 380, c.parchment))}
    <circle cx="300" cy="140" r="140" fill="url(#moon)"/>
    <circle cx="300" cy="140" r="50" fill="#DDE8B0" stroke="#B8C48A" stroke-width="3"/>`,
    1,
  );

  // Дальние кривые деревья.
  const farTree = (x: number, h: number): string => `
    <path d="M${x} 560 Q${x - 6} ${560 - h * 0.5} ${x + 8} ${560 - h} Q${x + 14} ${560 - h * 0.5} ${x + 22} 560 Z" fill="${barkFar}"/>
    <path d="M${x + 8} ${560 - h * 0.7} Q${x - 30} ${560 - h * 0.9} ${x - 40} ${560 - h * 0.8} M${x + 12} ${560 - h * 0.8} Q${x + 50} ${560 - h} ${x + 60} ${560 - h * 0.85}" fill="none" stroke="${barkFar}" stroke-width="6" stroke-linecap="round"/>
    <ellipse cx="${x + 10}" cy="${560 - h}" rx="${40 + h * 0.15}" ry="${24 + h * 0.08}" fill="#1E3326"/>`;
  let farDots = '';
  for (let i = 0; i < 30; i++) {
    farDots += `<circle cx="${(rng.next() * W).toFixed(0)}" cy="${(480 + rng.next() * 80).toFixed(0)}" r="${(1.5 + rng.next() * 2).toFixed(1)}" fill="${glow}" opacity="${(0.3 + rng.next() * 0.5).toFixed(2)}"/>`;
  }
  const far = art(
    'bg_forest_layer1',
    W,
    H,
    `<rect x="0" y="540" width="${W}" height="${H - 540}" fill="#16231C"/>
     ${tileX(W, farTree(60, 220) + farTree(240, 260) + farTree(470, 200) + farTree(700, 280) + farTree(930, 230) + farTree(1150, 250) + farDots)}`,
    1,
  );

  // Средние деревья с глазами в дуплах.
  const eyeTree = (x: number, h: number): string => `
    <path d="M${x} ${groundY + 20} Q${x - 10} ${groundY - h * 0.5} ${x + 10} ${groundY - h} L${x + 44} ${groundY - h} Q${x + 60} ${groundY - h * 0.5} ${x + 54} ${groundY + 20} Z" fill="${bark}" ${stroke(3)}/>
    <path d="M${x + 14} ${groundY - h + 10} Q${x - 30} ${groundY - h - 20} ${x - 50} ${groundY - h} M${x + 40} ${groundY - h + 6} Q${x + 80} ${groundY - h - 40} ${x + 110} ${groundY - h - 10}" fill="none" stroke="${bark}" stroke-width="10" stroke-linecap="round"/>
    <ellipse cx="${x + 27}" cy="${groundY - h * 0.55}" rx="12" ry="16" fill="#120C10" ${stroke(3)}/>
    <circle cx="${x + 24}" cy="${groundY - h * 0.56}" r="5" fill="${c.parchment}"/><circle cx="${x + 31}" cy="${groundY - h * 0.56}" r="4" fill="${c.parchment}"/>
    <circle cx="${x + 25}" cy="${groundY - h * 0.56}" r="2" fill="${c.outline}"/><circle cx="${x + 32}" cy="${groundY - h * 0.56}" r="1.8" fill="${c.outline}"/>
    <ellipse cx="${x + 27}" cy="${groundY - h - 10}" rx="70" ry="34" fill="${mossShade}" ${stroke(3)}/>`;
  const mid = art(
    'bg_forest_layer2',
    W,
    H,
    tileX(W, `${eyeTree(80, 300)}${eyeTree(520, 260)}${eyeTree(940, 320)}`),
    1,
  );

  // Ближний ярус: корни, грибы, папоротник.
  const roots = (x: number): string =>
    `<path d="M${x} ${groundY + 6} Q${x + 30} ${groundY - 50} ${x + 80} ${groundY - 30} Q${x + 120} ${groundY - 10} ${x + 150} ${groundY + 6}" fill="none" stroke="${bark}" stroke-width="16" stroke-linecap="round"/>`;
  const shroomCluster = (x: number): string =>
    [0, 22, 40]
      .map(
        (
          dx,
          i,
        ) => `<rect x="${x + dx + 6}" y="${groundY - 30 + i * 6}" width="8" height="${30 - i * 6}" fill="${c.parchment}" ${stroke(2)}/>
      <path d="M${x + dx - 6} ${groundY - 28 + i * 6} Q${x + dx + 10} ${groundY - 52 + i * 8} ${x + dx + 26} ${groundY - 28 + i * 6} Z" fill="${i === 1 ? glow : shroom}" ${stroke(2.5)}/>`,
      )
      .join('');
  const fern = (x: number): string =>
    `<path d="M${x} ${groundY} Q${x - 20} ${groundY - 40} ${x - 40} ${groundY - 50} M${x} ${groundY} Q${x + 10} ${groundY - 50} ${x + 30} ${groundY - 64} M${x} ${groundY} Q${x + 30} ${groundY - 30} ${x + 56} ${groundY - 36}" fill="none" stroke="${moss}" stroke-width="6" stroke-linecap="round"/>`;
  const near = art(
    'bg_forest_layer3',
    W,
    H,
    tileX(
      W,
      `${roots(100)}${roots(700)}${shroomCluster(380)}${shroomCluster(1000)}${fern(300)}${fern(620)}${fern(1180)}`,
    ),
    1,
  );

  // Земля: мшистая тропа.
  let pebbles = '';
  for (let i = 0; i < 40; i++) {
    pebbles += `<ellipse cx="${(rng.next() * W).toFixed(0)}" cy="${(40 + rng.next() * 70).toFixed(0)}" rx="${(3 + rng.next() * 7).toFixed(0)}" ry="3" fill="#2A2018"/>`;
  }
  const ground = art(
    'ground_forest',
    W,
    H - groundY,
    `<rect x="0" y="0" width="${W}" height="${H - groundY}" fill="#33261C"/>
     ${tileX(W, pebbles)}
     <path d="M-10 4 Q160 -2 320 6 Q480 12 640 4 Q800 -2 960 6 Q1120 12 1290 4 L1290 26 L-10 26 Z" fill="${moss}" ${stroke()}/>
     <path d="M-10 26 L1290 26" ${stroke()}/>`,
    1,
  );
  return [sky, far, mid, near, ground, fogArt('fog_forest', '#9FC8A0', rng)];
}

/** Затонувший город: неевклидова архитектура, лестницы в никуда, подводное свечение (SPEC §7). */
export function sunkenBackgroundArt(groundY: number): PlaceholderArt[] {
  const rng = new Rng(9090);
  const stone = '#4F6B78';
  const stoneFar = '#1E3440';
  const stoneMid = '#2E4A58';

  let rays = '';
  for (let i = 0; i < 6; i++) {
    const x = 100 + i * 210 + rng.next() * 60;
    rays += `<path d="M${x} 0 L${x + 80} 0 L${x + 200} ${H} L${x + 60} ${H} Z" fill="${c.bioCyan}" opacity="0.05"/>`;
  }
  let bubbles = '';
  for (let i = 0; i < 40; i++) {
    bubbles += `<circle cx="${(rng.next() * W).toFixed(0)}" cy="${(rng.next() * 500).toFixed(0)}" r="${(1.5 + rng.next() * 4).toFixed(1)}" fill="none" stroke="${c.bioCyan}" stroke-width="1.5" opacity="${(0.2 + rng.next() * 0.4).toFixed(2)}"/>`;
  }
  const sky = art(
    'bg_sunken_layer0',
    W,
    H,
    `<defs><linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0F3B55"/><stop offset="0.5" stop-color="#0B2238"/><stop offset="1" stop-color="#071422"/>
    </linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#sea)"/>
    ${tileX(W, rays + bubbles)}`,
    1,
  );

  // Дальний город: башни под странными углами.
  const tower = (x: number, h: number, tilt: number): string => `
    <g transform="rotate(${tilt} ${x + 20} 560)">
      <rect x="${x}" y="${560 - h}" width="40" height="${h}" fill="${stoneFar}"/>
      <path d="M${x - 6} ${560 - h} L${x + 20} ${560 - h - 40} L${x + 46} ${560 - h} Z" fill="${stoneFar}"/>
      <rect x="${x + 14}" y="${560 - h * 0.7}" width="10" height="14" fill="${c.bioCyan}" opacity="0.5"/>
    </g>`;
  const stairs = (x: number, y: number): string => {
    let st = '';
    for (let i = 0; i < 6; i++)
      st += `<rect x="${x + i * 16}" y="${y - i * 14}" width="18" height="${14 + i * 14}" fill="${stoneFar}"/>`;
    return st;
  };
  const far = art(
    'bg_sunken_layer1',
    W,
    H,
    `<rect x="0" y="540" width="${W}" height="${H - 540}" fill="#0E1C28"/>
     ${tileX(W, tower(80, 260, -6) + tower(300, 200, 8) + stairs(420, 420) + tower(640, 300, -3) + tower(900, 220, 12) + stairs(1060, 380) + tower(1200, 240, -9))}`,
    1,
  );

  // Средний ярус: арки и колонны со светящимися окнами.
  const arch = (x: number, w: number, h: number): string => `
    <path d="M${x} ${groundY + 20} L${x} ${groundY - h} Q${x + w / 2} ${groundY - h - w * 0.6} ${x + w} ${groundY - h} L${x + w} ${groundY + 20} L${x + w - 26} ${groundY + 20} L${x + w - 26} ${groundY - h + 10} Q${x + w / 2} ${groundY - h - w * 0.3} ${x + 26} ${groundY - h + 10} L${x + 26} ${groundY + 20} Z"
      fill="${stoneMid}" ${stroke(3)}/>
    <circle cx="${x + w / 2}" cy="${groundY - h - w * 0.25}" r="8" fill="${c.bioCyan}" opacity="0.7"/>`;
  const mid = art(
    'bg_sunken_layer2',
    W,
    H,
    tileX(W, `${arch(60, 200, 220)}${arch(520, 160, 260)}${arch(900, 220, 200)}`),
    1,
  );

  // Ближний ярус: водоросли, кораллы, обломки статуй.
  const kelp = (x: number, h: number): string =>
    `<path d="M${x} ${groundY + 4} Q${x - 20} ${groundY - h * 0.3} ${x + 6} ${groundY - h * 0.6} Q${x + 24} ${groundY - h * 0.85} ${x + 4} ${groundY - h}" fill="none" stroke="${c.seaGreen}" stroke-width="9" stroke-linecap="round"/>`;
  const coral = (x: number): string =>
    `<path d="M${x} ${groundY + 4} L${x} ${groundY - 30} M${x} ${groundY - 20} L${x - 16} ${groundY - 44} M${x} ${groundY - 26} L${x + 18} ${groundY - 50}" fill="none" stroke="#E58FA8" stroke-width="8" stroke-linecap="round"/>`;
  const statue = (x: number): string =>
    `<path d="M${x} ${groundY + 6} L${x + 4} ${groundY - 70} Q${x + 30} ${groundY - 100} ${x + 56} ${groundY - 70} L${x + 60} ${groundY + 6} Z" fill="${stone}" ${stroke(3)}/>
     <path d="M${x + 16} ${groundY - 64} Q${x + 22} ${groundY - 70} ${x + 28} ${groundY - 64} M${x + 34} ${groundY - 64} Q${x + 40} ${groundY - 70} ${x + 46} ${groundY - 64}" fill="none" ${stroke(3)}/>`;
  const near = art(
    'bg_sunken_layer3',
    W,
    H,
    tileX(
      W,
      `${kelp(140, 200)}${kelp(170, 150)}${coral(420)}${statue(640)}${kelp(880, 220)}${coral(1100)}${kelp(1230, 160)}`,
    ),
    1,
  );

  // Земля: каменные плиты с трещинами, из которых сочится свет.
  let tiles = '';
  for (let x = 0; x < W; x += 96) {
    tiles += `<path d="M${x} 4 L${x} 30" ${stroke(3)}/>`;
  }
  let cracks = '';
  for (let i = 0; i < 10; i++) {
    const x = rng.next() * W;
    cracks += `<path d="M${x.toFixed(0)} 30 l${(10 + rng.next() * 20).toFixed(0)} ${(20 + rng.next() * 30).toFixed(0)} l${(-10 + rng.next() * 20).toFixed(0)} ${(15 + rng.next() * 20).toFixed(0)}" fill="none" stroke="${c.bioCyan}" stroke-width="2" opacity="0.5"/>`;
  }
  const ground = art(
    'ground_sunken',
    W,
    H - groundY,
    `<rect x="0" y="0" width="${W}" height="${H - groundY}" fill="#13232E"/>
     ${tileX(W, cracks)}
     <rect x="-10" y="2" width="${W + 20}" height="28" fill="${stone}" ${stroke()}/>
     <rect x="-10" y="20" width="${W + 20}" height="10" fill="#3A5260"/>
     ${tiles}`,
    1,
  );
  return [sky, far, mid, near, ground, fogArt('fog_sunken', '#7FB8D0', rng)];
}
