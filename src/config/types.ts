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
  /** Автопрыжок (позднее улучшение): за сколько px до препятствия прыгать. */
  autoJumpLookaheadPx: number;
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

export interface AwakeningConfig {
  killsToFill: number;
  durationSec: number;
  coinMult: number;
  sanityCost: number;
  /** Твари ближе этого расстояния перед героем гибнут при появлении. */
  screenAheadPx: number;
}

export interface RunConfig {
  maxStepSec: number;
  world: WorldConfig;
  hero: HeroConfig;
  glide: GlideConfig;
  attack: AttackConfig;
  awakening: AwakeningConfig;
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
  startCoins: number;
  /** coinValue = baseValue × (1 + CpS × cpsFactor) × множители (SPEC §5.2). */
  coin: { baseValue: number; radius: number; cpsFactor: number };
  offline: { rate: number; capSec: number; minSec: number; useIdleSanity: boolean };
  autosaveSec: number;
  combo: ComboConfig;
  chest: { coinUnits: number; sardines: Range };
  prestige: PrestigeConfig;
}

export interface OmenConfig {
  id: string;
  add?: Partial<RunModifiers>;
  mul?: Partial<RunModifiers>;
}

export interface PrestigeConfig {
  /** тёмные_звёзды = floor(sqrt(дублоны_за_погружение / divisor)). */
  divisor: number;
  minStars: number;
  /** Общий множитель дохода: 1 + starBonus × тёмные_звёзды. */
  starBonus: number;
  omenChoices: number;
  omens: readonly OmenConfig[];
}

export interface ItemConfig {
  id: string;
  base: number;
  cps: number;
}

/**
 * Все бонусы: улучшения героя, гримуар, знамение, кот. Источники складываются
 * (`add`) или перемножаются (`mul`); нейтральные значения — в Upgrades.baseModifiers().
 */
export interface RunModifiers {
  attackRangeMult: number;
  staminaBonusSec: number;
  speedBonus: number;
  speedMult: number;
  magnetRadius: number;
  extraJumps: number;
  coinValueMult: number;
  autoJump: number;
  cpsMult: number;
  essenceMult: number;
  offlineCapBonusSec: number;
  offlineRateMult: number;
  sanityDrainMult: number;
  sanityPickupMult: number;
  contactLossMult: number;
  insightRewardMult: number;
  awakeningKillsMult: number;
  awakeningDurationMult: number;
  awakeningCoinMult: number;
  dreamRewardMult: number;
  pageChanceMult: number;
  sardineMult: number;
  chestChanceBonus: number;
  catIntervalMult: number;
  catRangeBonus: number;
}

export type ModifierKey = keyof RunModifiers;

export interface HeroUpgradeConfig {
  id: string;
  /** Цена каждого уровня (тиры покупаются по порядку). */
  costs: readonly number[];
  /** Прибавка за уровень. */
  add?: Partial<RunModifiers>;
  /** Множитель за уровень. */
  mul?: Partial<RunModifiers>;
}

export interface UpgradesConfig {
  growth: number;
  milestones: { levels: readonly number[]; multiplier: number };
  items: readonly ItemConfig[];
  hero: readonly HeroUpgradeConfig[];
}

export const ENEMY_BEHAVIORS = ['walker', 'flyer', 'hopper', 'burrower', 'blinker'] as const;
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
  /** burrower: скорость под землёй и расстояние до героя, на котором тварь вылезает. */
  burrowSpeed?: number;
  emergePx?: number;
  /** blinker: период перескока между землёй и высотой altitude, с; резкость перескока, 1/с. */
  blinkPeriodSec?: number;
  blinkSnapPerSec?: number;
  /** Отброс после удара, если hp > 1. */
  knockback?: number;
  /** Эссенция за убийство (валюта гримуара). */
  essence: number;
  chestChance: number;
}

export interface SizeConfig {
  width: number;
  height: number;
}

export const PATTERNS = ['coinsGround', 'coinsSky', 'obstacle', 'enemy', 'pickup'] as const;
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
  pickupWeights: Record<string, number>;
  /** Пикапы рассудка: размер и высота центра над землёй. */
  pickups: Record<string, SizeConfig & { lift: number }>;
  /** Высота страниц книги над землёй и их размер. */
  pageLift: Range;
  pageSize: SizeConfig;
  /** Сколько пройти в биоме до босса, м. */
  lengthM: number;
  /** Босс биома (ключ в progression.json → bosses). */
  boss: string;
  /** Множитель дублонов в биоме (дальние биомы щедрее). */
  coinMult: number;
  miniBoss: MiniBossConfig;
}

/** Мини-босс: увеличенная тварь биома с запасом здоровья и крупной наградой. */
export interface MiniBossConfig {
  everyM: number;
  chance: number;
  scale: number;
  hpMult: number;
  rewardMult: number;
  essenceMult: number;
  /** Отброс от каждого удара: мини-босс не проскакивает зону вспышки. */
  knockback: number;
}

export const BOSS_ATTACKS = ['wave', 'summon'] as const;
export type BossAttack = (typeof BOSS_ATTACKS)[number];

/**
 * Босс биома: держится впереди героя, периодически подлетает в зону вспышки фонаря,
 * между подлётами пускает по земле волны (перепрыгнуть) и призывает тварей.
 */
export interface BossConfig {
  hp: number;
  width: number;
  height: number;
  /** Высота центра над землёй; 0 — стоит на земле. */
  altitude: number;
  /** Дистанция от героя в покое и при подлёте, px. */
  holdPx: number;
  exposePx: number;
  /** Цикл: подлёт approachSec → у героя exposeSec → отход approachSec → пауза до cycleSec. */
  cycleSec: number;
  approachSec: number;
  exposeSec: number;
  attackEverySec: number;
  attacks: readonly BossAttack[];
  summon: readonly string[];
  wave: { key: string; width: number; height: number; speed: number };
  /** Не побеждён за это время — уходит; путь откатывается до retreatTo × длины биома. */
  fightSec: number;
  retreatTo: number;
  /** Награда: единицы номинала монеты, Эссенция, сардинки. */
  coins: number;
  essence: number;
  sardines: number;
}

export interface ProgressionConfig {
  /** Порядок биомов; после последнего — новый круг с начала. */
  order: readonly string[];
  /** Новый круг: hp боссов × (1 + hpMult × круг), награды и монеты — аналогично. */
  lap: { hpMult: number; rewardMult: number; coinMult: number };
  /** Пауза между победой над боссом и сменой биома, с. */
  transitionSec: number;
  /** Выход босса из-за края экрана, с; покачивание, px; скорость ухода сверх героя, px/с. */
  bossEntrySec: number;
  bossBobPx: number;
  bossLeaveSpeed: number;
  bosses: Record<string, BossConfig>;
}

export interface SanityConfig {
  max: number;
  start: number;
  drainPerSec: number;
  contactLoss: number;
  pickups: Record<string, number>;
  /** Множитель монет = 1 + (max − рассудок) × coinMultPerPoint, не выше coinMultCap. */
  coinMultPerPoint: number;
  coinMultCap: number;
  distortAt: number;
  invisibleAt: number;
  illusionChance: number;
  hiddenChance: number;
  revealPx: number;
  insight: { stunSec: number; restoreTo: number; coinUnits: number };
  /** Рассудок пассивного режима (офлайн-доход). */
  idleSanity: number;
}

/** Модификаторы небесной фазы; отсутствующие — нейтральные. */
export interface PhaseConfig {
  weight: number;
  glideStaminaMult?: number;
  skyCoinsWeightMult?: number;
  enemyWeightMult?: number;
  essenceMult?: number;
  speedMult?: number;
  coinValueMult?: number;
  starCoinChance?: number;
  starCoinUnits?: number;
  sanityDrainMult?: number;
  miniBossChanceMult?: number;
}

export interface StarsConfig {
  periodSec: number;
  phases: Record<string, PhaseConfig>;
}

export interface DreamConfig {
  pagesNeeded: number;
  pageChance: number;
  durationSec: number;
  gravity: number;
  flapVelocity: number;
  maxFall: number;
  ceilingY: number;
  floorY: number;
  baseSpeed: number;
  boostSpeed: number;
  boostDecayPerSec: number;
  rhythm: { periodSec: number; greenFrom: number; greenTo: number };
  ringEveryPx: Range;
  ringGap: number;
  ringHeightRange: Range;
  coinLineEveryPx: Range;
  coinsPerLine: Range;
  coinSpacing: number;
  islandEveryPx: Range;
  reward: {
    coinWeight: number;
    ringWeight: number;
    cpsSecPerPoint: number;
    sardinesPerRing: number;
    minSardines: number;
  };
}

/** Скин кота — только внешний вид; цена в сардинках, первый в списке — бесплатный по умолчанию. */
export interface CatSkinConfig {
  id: string;
  cost: number;
}

export interface CatConfig {
  intervalSec: number;
  rangePx: number;
  hissRangePx: number;
  chestChance: number;
  upgrades: readonly HeroUpgradeConfig[];
  skins: readonly CatSkinConfig[];
}

export const GRIMOIRE_CHAPTERS = ['hunter', 'dreamer', 'winged'] as const;
export type GrimoireChapter = (typeof GRIMOIRE_CHAPTERS)[number];

export interface GrimoireNodeConfig {
  id: string;
  chapter: GrimoireChapter;
  col: number;
  row: number;
  /** Цена в Эссенции. */
  cost: number;
  requires: readonly string[];
  /** Сколько тёмных звёзд нужно иметь, чтобы узел открылся. */
  darkStars?: number;
  /** Узел переживает Погружение. */
  keep?: boolean;
  add?: Partial<RunModifiers>;
  mul?: Partial<RunModifiers>;
}

export interface GrimoireConfig {
  chapters: readonly GrimoireChapter[];
  nodes: readonly GrimoireNodeConfig[];
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
  /**
   * Объём монеты: толщина ребра (ед.), число слоёв ребра (чередуются — насечки),
   * сила и острота блика, когда лицевая сторона смотрит на свет.
   */
  coin3d: { thickness: number; edgeLayers: number; glint: number; glintPower: number };
  flashMs: number;
  /** Длительности выстрела фонаря: вспышка, луч, всплеск попадания. */
  shot: { muzzleSec: number; boltSec: number; impactSec: number };
  /** Во сколько раз плейсхолдер-текстуры крупнее игровых единиц (PNG@2x). */
  textureScale: number;
}

/** Постройка городка: цена base × growth^уровень, эффект за уровень (SPEC §6). */
export interface BuildingConfig {
  id: string;
  base: number;
  growth: number;
  maxLevel: number;
  add?: Partial<RunModifiers>;
  mul?: Partial<RunModifiers>;
}

export interface TownConfig {
  buildings: readonly BuildingConfig[];
  /** Уровень маяка, при котором туман над городком рассеивается полностью. */
  fogClearLevel: number;
}

export interface JournalConfig {
  /** Порядок карточек в дневнике. */
  creatures: readonly string[];
  bosses: readonly string[];
  /** Сколько встреч нужно для полной записи (у боссов — отдельно). */
  fullAt: number;
  bossFullAt: number;
  /** Бонус за каждую полную запись. */
  bonusPerFull: { add?: Partial<RunModifiers>; mul?: Partial<RunModifiers> };
  share: { url: string; width: number; height: number };
}

export interface AchievementGroupConfig {
  /** Показатель из Achievements.statValue. */
  stat: string;
  tiers: readonly number[];
}

export interface AchievementsConfig {
  /** Каждое достижение: +bonus к доходу (складываются). */
  bonusPerAchievement: number;
  groups: readonly AchievementGroupConfig[];
}

export interface NewspaperConfig {
  dayMs: number;
  /** Награда за N-й день серии: секунд дохода (последнее значение — для всех дней дальше). */
  rewardCpsSec: readonly number[];
  /** Минимум в номиналах монеты (если дохода ещё мало). */
  minCoinUnits: number;
  sardines: readonly number[];
  essence: readonly number[];
  /** Сколько заголовков в i18n (news.h1…) и сколько в одном выпуске. */
  headlines: number;
  perIssue: number;
}
