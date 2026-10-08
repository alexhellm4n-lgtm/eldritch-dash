/** Типы конфигов. Сами значения живут в соседних *.json (SPEC §0.3). */

export type Range = readonly [min: number, max: number];

export interface WorldConfig {
  groundY: number;
  pxPerMeter: number;
  /** Когда герой уходит дальше этой координаты, мир сдвигается к нулю (точность float32 в WebGL). */
  rebaseAtPx: number;
  spawnAheadPx: number;
  despawnBehindPx: number;
}

export interface HeroConfig {
  screenX: number;
  width: number;
  height: number;
  baseSpeed: number;
  maxSpeed: number;
  accel: number;
  gravity: number;
  jumpVelocity: number;
  airJumpVelocity: number;
  maxJumps: number;
  jumpBufferSec: number;
  magnetRadius: number;
  magnetSpeed: number;
  obstacleStunSec: number;
  enemyStunSec: number;
}

export interface GlideConfig {
  staminaSec: number;
  regenPerSec: number;
  gravity: number;
  maxFallSpeed: number;
}

export interface AttackConfig {
  range: number;
  height: number;
  reachBehind: number;
  cooldownSec: number;
}

export interface RunConfig {
  maxStepSec: number;
  world: WorldConfig;
  hero: HeroConfig;
  glide: GlideConfig;
  attack: AttackConfig;
}

export interface ComboStep {
  streak: number;
  multiplier: number;
}

export interface ComboConfig {
  streakPerObstacle: number;
  streakPerKill: number;
  maxMultiplier: number;
  steps: readonly ComboStep[];
}

export interface EconomyConfig {
  coin: { baseValue: number; radius: number };
  combo: ComboConfig;
}

export const ENEMY_BEHAVIORS = ['walker', 'flyer', 'hopper'] as const;
export type EnemyBehavior = (typeof ENEMY_BEHAVIORS)[number];

export interface EnemyConfig {
  behavior: EnemyBehavior;
  hp: number;
  width: number;
  height: number;
  speed: number;
  coins: number;
  /** flyer: высота центра над землёй. */
  altitude?: number;
  bobAmp?: number;
  bobFreq?: number;
  /** hopper */
  hopHeight?: number;
  hopPeriodSec?: number;
  /** Отброс после удара, если hp > 1. */
  knockback?: number;
}

export interface SizeConfig {
  width: number;
  height: number;
}

export const PATTERNS = ['coinsGround', 'coinsSky', 'obstacle', 'enemy'] as const;
export type PatternKind = (typeof PATTERNS)[number];

export interface BiomeConfig {
  safeStartPx: number;
  gapPx: Range;
  minHazardGapPx: number;
  patternWeights: Record<PatternKind, number>;
  enemyWeights: Record<string, number>;
  obstacleWeights: Record<string, number>;
  obstacles: Record<string, SizeConfig>;
  coinsGround: { count: Range; spacing: number; height: number };
  coinsSky: { count: Range; spacing: number; baseHeight: number; arcHeight: number };
  obstacleArc: {
    chance: number;
    count: number;
    spacing: number;
    clearance: number;
    arcHeight: number;
  };
  parallax: readonly number[];
  fogDriftPxPerSec: number;
}

export interface ShakeConfig {
  ms: number;
  intensity: number;
}

export interface JuiceConfig {
  hitStopMs: number;
  shake: { kill: ShakeConfig; armorHit: ShakeConfig; stun: ShakeConfig };
  popup: { risePx: number; ms: number; poolSize: number };
  squash: { jumpMs: number; landMs: number; amount: number };
  stretch: { perVelocity: number; max: number };
  particles: { coin: number; kill: number; dust: number; drops: number };
  coinSpinPerSec: number;
  flashMs: number;
  /** Во сколько раз плейсхолдер-текстуры крупнее игровых единиц (PNG@2x). */
  textureScale: number;
}
