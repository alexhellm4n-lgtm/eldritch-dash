import { describe, expect, it, vi } from 'vitest';
import { enemiesConfig, runConfig } from '../src/config';
import { Combat } from '../src/systems/Combat';
import { Entity } from '../src/systems/Entity';
import { HeroMotor } from '../src/systems/HeroMotor';

const { hero: heroCfg, glide, world, attack } = runConfig;

function setup() {
  const hero = new HeroMotor(heroCfg, glide, world.groundY);
  const combat = new Combat(attack, heroCfg, enemiesConfig);
  return { hero, combat };
}

function enemy(type: string, x: number, y?: number): Entity {
  const cfg = enemiesConfig[type]!;
  const e = new Entity().reset(1, 'enemy', type);
  e.w = cfg.width;
  e.h = cfg.height;
  e.hp = cfg.hp;
  e.x = x;
  e.y = y ?? world.groundY - cfg.height / 2;
  return e;
}

describe('Combat', () => {
  it('убивает наземного врага в зоне перед героем', () => {
    const { hero, combat } = setup();
    const e = enemy('fishman', hero.x + heroCfg.width / 2 + attack.range / 2);
    const onHit = vi.fn();
    expect(combat.update(0.016, hero, [e], onHit)).toBe(true);
    expect(onHit).toHaveBeenCalledWith(e, 'killed');
  });

  it('не трогает врага вне радиуса', () => {
    const { hero, combat } = setup();
    const e = enemy('fishman', hero.x + heroCfg.width / 2 + attack.range + 100);
    const onHit = vi.fn();
    expect(combat.update(0.016, hero, [e], onHit)).toBe(false);
    expect(onHit).not.toHaveBeenCalled();
  });

  it('бронированный враг: два удара с перезарядкой и отбросом', () => {
    const { hero, combat } = setup();
    const e = enemy('walkingNet', hero.x + heroCfg.width / 2 + 40);
    const onHit = vi.fn();
    combat.update(0.016, hero, [e], onHit);
    expect(onHit).toHaveBeenLastCalledWith(e, 'hurt');
    expect(e.x).toBeGreaterThan(hero.x + heroCfg.width / 2 + 40);
    // Пока идёт перезарядка — не бьёт, даже если враг вернулся в зону.
    e.x = hero.x + heroCfg.width / 2 + 40;
    combat.update(attack.cooldownSec / 2, hero, [e], onHit);
    expect(onHit).toHaveBeenCalledTimes(1);
    combat.update(attack.cooldownSec, hero, [e], onHit);
    expect(onHit).toHaveBeenLastCalledWith(e, 'killed');
  });

  it('летающего врага с земли не достать, в прыжке — достать', () => {
    const { hero, combat } = setup();
    const gull = enemiesConfig.gull!;
    const e = enemy('gull', hero.x + heroCfg.width / 2 + 60, world.groundY - gull.altitude!);
    const onHit = vi.fn();
    combat.update(0.016, hero, [e], onHit);
    expect(onHit).not.toHaveBeenCalled();
    hero.y = world.groundY - heroCfg.jumpVelocity ** 2 / (2 * heroCfg.gravity);
    combat.update(0.016, hero, [e], onHit);
    expect(onHit).toHaveBeenCalledWith(e, 'killed');
  });
});
