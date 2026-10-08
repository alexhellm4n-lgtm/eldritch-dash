import type { AttackConfig, EnemyConfig, HeroConfig } from '../config/types';
import { overlaps, type Entity } from './Entity';
import type { HeroMotor } from './HeroMotor';

export type HitResult = 'hurt' | 'killed';

/**
 * Автоатака фонарём: вспышка поражает всех врагов в зоне перед героем, затем перезарядка.
 * Зона: от передней кромки героя на `range` вперёд и на `height` вверх от ступней.
 */
export class Combat {
  cooldownLeft = 0;
  /** Сработала ли вспышка на последнем шаге. */
  flashed = false;
  /** Множитель радиуса вспышки (улучшение «радиус фонаря»). */
  rangeMult = 1;

  constructor(
    private readonly attack: AttackConfig,
    private readonly hero: HeroConfig,
    private readonly enemies: Readonly<Record<string, EnemyConfig>>,
  ) {}

  get range(): number {
    return this.attack.range * this.rangeMult;
  }

  zoneX(hero: HeroMotor): number {
    const front = hero.x + this.hero.width / 2;
    return front - this.attack.reachBehind + this.zoneW / 2;
  }

  zoneY(hero: HeroMotor): number {
    return hero.y - this.attack.height / 2;
  }

  get zoneW(): number {
    return this.range + this.attack.reachBehind;
  }

  inZone(hero: HeroMotor, e: Entity): boolean {
    return overlaps(
      this.zoneX(hero),
      this.zoneY(hero),
      this.zoneW,
      this.attack.height,
      e.x,
      e.y,
      e.w,
      e.h,
    );
  }

  /** Возвращает true, если в этом шаге произошла вспышка. Результаты удара пишет в `onHit`. */
  update(
    dt: number,
    hero: HeroMotor,
    enemies: readonly Entity[],
    onHit: (e: Entity, result: HitResult) => void,
  ): boolean {
    this.flashed = false;
    this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    if (this.cooldownLeft > 0) return false;

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]!;
      if (e.kind !== 'enemy' || e.spent || e.hp <= 0 || !this.inZone(hero, e)) continue;
      this.flashed = true;
      e.hp--;
      e.hurtT = 0;
      if (e.hp <= 0) {
        onHit(e, 'killed');
      } else {
        e.x += this.enemies[e.type]?.knockback ?? 0;
        onHit(e, 'hurt');
      }
    }
    if (this.flashed) this.cooldownLeft = this.attack.cooldownSec;
    return this.flashed;
  }
}
