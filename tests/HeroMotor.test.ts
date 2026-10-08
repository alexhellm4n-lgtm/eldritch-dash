import { describe, expect, it } from 'vitest';
import { runConfig, type HeroConfig } from '../src/config';
import { HeroMotor } from '../src/systems/HeroMotor';

const DT = 1 / 120;
const { hero: heroCfg, glide, world } = runConfig;

function motor(overrides: Partial<HeroConfig> = {}): HeroMotor {
  return new HeroMotor({ ...heroCfg, ...overrides }, glide, world.groundY);
}

function step(m: HeroMotor, sec: number, each?: () => void): void {
  for (let t = 0; t < sec; t += DT) {
    m.update(DT);
    each?.();
  }
}

describe('HeroMotor', () => {
  it('бежит вправо с базовой скоростью', () => {
    const m = motor();
    step(m, 1);
    expect(m.x).toBeCloseTo(heroCfg.baseSpeed, -1);
  });

  it('скорость не превышает кап', () => {
    const m = motor({ baseSpeed: 99999 });
    expect(m.targetSpeed).toBe(heroCfg.maxSpeed);
  });

  it('прыжок достигает высоты v²/2g и приземляется', () => {
    const m = motor();
    m.press();
    m.release();
    let peak = 0;
    let landed = false;
    step(m, 2, () => {
      peak = Math.max(peak, world.groundY - m.y);
      landed ||= m.justLanded;
    });
    const expected = heroCfg.jumpVelocity ** 2 / (2 * heroCfg.gravity);
    expect(peak).toBeGreaterThan(expected * 0.95);
    expect(peak).toBeLessThan(expected * 1.05);
    expect(landed).toBe(true);
    expect(m.grounded).toBe(true);
  });

  it('без апгрейда второй прыжок в воздухе не срабатывает', () => {
    const m = motor();
    m.press();
    m.release();
    step(m, 0.15);
    const vyBefore = m.vy;
    m.press();
    m.update(DT);
    expect(m.vy).toBeGreaterThan(vyBefore);
    expect(m.jumpsUsed).toBe(1);
  });

  it('двойной прыжок при maxJumps = 2', () => {
    const m = motor({ maxJumps: 2 });
    m.press();
    m.release();
    step(m, 0.15);
    m.press();
    m.update(DT);
    expect(m.justJumped).toBe(2);
    expect(m.vy).toBeLessThan(0);
  });

  it('буфер ввода: нажатие незадолго до приземления даёт прыжок', () => {
    const m = motor();
    m.press();
    m.release();
    while (!(m.vy > 0 && world.groundY - m.y < 15)) m.update(DT);
    m.press();
    m.release();
    let jumpedAgain = false;
    step(m, 0.2, () => (jumpedAgain ||= m.justJumped === 1));
    expect(jumpedAgain).toBe(true);
  });

  it('удержание после пика включает парение: медленное падение и расход выносливости', () => {
    const m = motor();
    m.press();
    let glided = false;
    let maxFall = 0;
    step(m, 1.2, () => {
      if (m.gliding) {
        glided = true;
        maxFall = Math.max(maxFall, m.vy);
      }
    });
    expect(glided).toBe(true);
    expect(maxFall).toBeLessThanOrEqual(glide.maxFallSpeed + 1e-6);
    expect(m.stamina).toBeLessThan(glide.staminaSec);
  });

  it('выносливость кончается → парение прекращается, на земле восстанавливается', () => {
    const m = motor();
    m.press();
    step(m, 0.4 + glide.staminaSec + 0.1);
    expect(m.stamina).toBe(0);
    expect(m.gliding).toBe(false);
    m.release();
    step(m, 1 + glide.staminaSec / glide.regenPerSec);
    expect(m.grounded).toBe(true);
    expect(m.stamina).toBe(glide.staminaSec);
  });

  it('оглушение останавливает и блокирует прыжок, затем разгон', () => {
    const m = motor();
    m.stun(heroCfg.obstacleStunSec);
    const x0 = m.x;
    m.press();
    step(m, heroCfg.obstacleStunSec * 0.9);
    expect(m.x).toBe(x0);
    expect(m.grounded).toBe(true);
    m.release();
    step(m, heroCfg.obstacleStunSec * 0.1 + heroCfg.baseSpeed / heroCfg.accel + 0.05);
    expect(m.speed).toBe(m.targetSpeed);
  });
});
