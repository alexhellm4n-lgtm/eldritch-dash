import type { OmenConfig, PrestigeConfig } from '../config/types';
import type { Decimal } from '../core/BigNum';
import { Rng } from './Rng';

/** тёмные_звёзды = floor(sqrt(дублоны_за_погружение / divisor)) (SPEC §5.2). */
export function darkStarsFor(coinsThisDive: Decimal, cfg: PrestigeConfig): number {
  const ratio = coinsThisDive.div(cfg.divisor);
  if (ratio.lte(0)) return 0;
  // sqrt через log10, чтобы не терять огромные значения при toNumber().
  const stars = 10 ** (ratio.log10() / 2);
  return Number.isFinite(stars) ? Math.floor(stars + 1e-9) : Number.MAX_SAFE_INTEGER;
}

export function canDive(coinsThisDive: Decimal, cfg: PrestigeConfig): boolean {
  return darkStarsFor(coinsThisDive, cfg) >= cfg.minStars;
}

/** Общий множитель дохода от тёмных звёзд: 1 + starBonus × звёзды. */
export function starMultiplier(darkStars: number, cfg: PrestigeConfig): number {
  return 1 + cfg.starBonus * darkStars;
}

/** Три случайных знамения на выбор; seed — глубина, чтобы выбор не «перекатывался» перезагрузкой. */
export function omenChoices(depth: number, cfg: PrestigeConfig): OmenConfig[] {
  const pool = [...cfg.omens];
  const rng = new Rng(0x51ab + depth * 7919);
  const out: OmenConfig[] = [];
  while (out.length < Math.min(cfg.omenChoices, pool.length)) {
    const i = Math.floor(rng.next() * pool.length);
    out.push(pool.splice(i, 1)[0]!);
  }
  return out;
}
