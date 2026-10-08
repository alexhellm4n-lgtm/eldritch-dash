import { PATTERNS, type BiomeConfig, type EnemyConfig, type PatternKind } from '../config/types';
import type { Entity, EntityKind } from './Entity';
import { WeightedTable, type Rng } from './Rng';

export type SpawnFn = (kind: EntityKind, type: string) => Entity;

/**
 * Процедурная трасса: перед героем раскладываются паттерны (линии монет, препятствия, враги)
 * с промежутками из конфига биома. Опасности не ставятся ближе minHazardGapPx друг к другу.
 */
export class Track {
  /** Координата, с которой начнётся следующий паттерн. */
  cursor: number;
  private lastHazardX = -Infinity;
  private readonly enemyTable: WeightedTable<string>;
  private readonly obstacleTable: WeightedTable<string>;
  private readonly pickupTable: WeightedTable<string>;
  /** Множители весов паттернов (фаза звёзд): враги, небесные линии монет. */
  enemyWeightMult = 1;
  skyCoinsWeightMult = 1;
  /** Шанс страницы книги после каждого паттерна. */
  pageChance = 0;

  constructor(
    private readonly biome: BiomeConfig,
    private readonly enemies: Readonly<Record<string, EnemyConfig>>,
    private readonly groundY: number,
    private readonly coinRadius: number,
    private readonly rng: Rng,
    private readonly spawn: SpawnFn,
    startX: number,
  ) {
    this.cursor = startX;
    this.enemyTable = new WeightedTable(biome.enemyWeights);
    this.obstacleTable = new WeightedTable(biome.obstacleWeights);
    this.pickupTable = new WeightedTable(biome.pickupWeights);
  }

  /** Взвешенный выбор паттерна с поправками фазы (без аллокаций). */
  private pickPattern(): PatternKind {
    const w = this.biome.patternWeights;
    const weight = (p: PatternKind): number =>
      w[p] *
      (p === 'enemy' ? this.enemyWeightMult : p === 'coinsSky' ? this.skyCoinsWeightMult : 1);
    let total = 0;
    for (const p of PATTERNS) total += weight(p);
    let roll = this.rng.next() * total;
    for (const p of PATTERNS) {
      roll -= weight(p);
      if (roll < 0) return p;
    }
    return 'coinsGround';
  }

  shift(dx: number): void {
    this.cursor += dx;
    this.lastHazardX += dx;
  }

  /** Заполняет трассу до `untilX`. */
  fill(untilX: number, safeUntilX: number): void {
    while (this.cursor < untilX) {
      let pattern = this.pickPattern();
      const hazard = pattern === 'obstacle' || pattern === 'enemy';
      if (this.cursor < safeUntilX) {
        // Стартовый отрезок — только наземные монеты: первая покупка без единого прыжка.
        pattern = 'coinsGround';
      } else if (hazard && this.cursor - this.lastHazardX < this.biome.minHazardGapPx) {
        pattern = this.rng.chance(0.5) ? 'coinsGround' : 'coinsSky';
      }
      this.place(pattern);
      const gap = this.rng.range(this.biome.gapPx);
      if (this.rng.chance(this.pageChance)) this.page(this.cursor + gap / 2);
      this.cursor += gap;
    }
  }

  private place(pattern: PatternKind): void {
    switch (pattern) {
      case 'coinsGround': {
        const c = this.biome.coinsGround;
        const n = this.rng.int(c.count);
        for (let i = 0; i < n; i++) this.coin(this.cursor + i * c.spacing, this.groundY - c.height);
        this.cursor += (n - 1) * c.spacing;
        break;
      }
      case 'coinsSky': {
        const c = this.biome.coinsSky;
        const n = this.rng.int(c.count);
        for (let i = 0; i < n; i++) {
          const k = n > 1 ? i / (n - 1) : 0.5;
          const y = this.groundY - c.baseHeight - c.arcHeight * Math.sin(Math.PI * k);
          this.coin(this.cursor + i * c.spacing, y);
        }
        this.cursor += (n - 1) * c.spacing;
        break;
      }
      case 'obstacle': {
        const type = this.obstacleTable.pick(this.rng);
        const size = this.biome.obstacles[type]!;
        const e = this.spawn('obstacle', type);
        e.w = size.width;
        e.h = size.height;
        e.x = this.cursor + size.width / 2;
        e.y = e.baseY = this.groundY - size.height / 2;
        this.lastHazardX = e.x;
        const arc = this.biome.obstacleArc;
        if (this.rng.chance(arc.chance)) {
          const half = (arc.count - 1) / 2;
          for (let i = 0; i < arc.count; i++) {
            const k = arc.count > 1 ? i / (arc.count - 1) : 0.5;
            const y =
              this.groundY - size.height - arc.clearance - arc.arcHeight * Math.sin(Math.PI * k);
            this.coin(e.x + (i - half) * arc.spacing, y);
          }
        }
        this.cursor += size.width;
        break;
      }
      case 'pickup': {
        const type = this.pickupTable.pick(this.rng);
        const p = this.biome.pickups[type]!;
        const e = this.spawn('pickup', type);
        e.w = p.width;
        e.h = p.height;
        e.x = this.cursor + p.width / 2;
        e.y = e.baseY = this.groundY - p.lift;
        this.cursor += p.width;
        break;
      }
      case 'enemy': {
        const type = this.enemyTable.pick(this.rng);
        const cfg = this.enemies[type]!;
        const e = this.spawn('enemy', type);
        e.w = cfg.width;
        e.h = cfg.height;
        e.hp = cfg.hp;
        e.x = this.cursor + cfg.width / 2;
        e.y = e.baseY =
          cfg.behavior === 'flyer'
            ? this.groundY - (cfg.altitude ?? 0)
            : this.groundY - cfg.height / 2;
        this.lastHazardX = e.x;
        this.cursor += cfg.width;
        break;
      }
    }
  }

  /** Вырванная страница запретной книги — парит в воздухе, достаётся прыжком. */
  private page(x: number): void {
    const e = this.spawn('pickup', 'page');
    e.w = this.biome.pageSize.width;
    e.h = this.biome.pageSize.height;
    e.x = x;
    e.y = e.baseY = this.groundY - this.rng.range(this.biome.pageLift);
  }

  private coin(x: number, y: number): void {
    const e = this.spawn('coin', '');
    e.x = x;
    e.y = e.baseY = y;
    e.w = e.h = this.coinRadius * 2;
  }
}
