import type { GlideConfig, HeroConfig } from '../config/types';

/**
 * Движение героя: автобег, прыжок (с буфером ввода), прыжок в воздухе, парение, оглушение.
 * x — центр по горизонтали, y — уровень ступней.
 */
export class HeroMotor {
  x = 0;
  y: number;
  speed = 0;
  vy = 0;
  grounded = true;
  jumpsUsed = 0;
  stamina: number;
  gliding = false;
  stunLeft = 0;
  held = false;
  maxJumps: number;
  targetSpeed: number;
  /** Максимум выносливости парения (база + улучшения), с. */
  staminaMax: number;

  /** Флаги событий последнего шага; сбрасываются в начале update(). */
  justJumped = 0;
  justLanded = false;
  glideStarted = false;
  glideEnded = false;

  private bufferLeft = 0;

  constructor(
    private readonly cfg: HeroConfig,
    private readonly glide: GlideConfig,
    private readonly groundY: number,
  ) {
    this.y = groundY;
    this.stamina = this.staminaMax = glide.staminaSec;
    this.maxJumps = cfg.maxJumps;
    this.targetSpeed = Math.min(cfg.baseSpeed, cfg.maxSpeed);
    this.speed = this.targetSpeed;
  }

  get stunned(): boolean {
    return this.stunLeft > 0;
  }

  get staminaRatio(): number {
    return this.stamina / this.staminaMax;
  }

  /** Улучшения героя: бонус скорости (с капом), дополнительные прыжки, выносливость. */
  applyUpgrades(speedBonus: number, extraJumps: number, staminaBonusSec: number): void {
    this.targetSpeed = Math.min(this.cfg.baseSpeed + speedBonus, this.cfg.maxSpeed);
    this.maxJumps = this.cfg.maxJumps + extraJumps;
    this.staminaMax = this.glide.staminaSec + staminaBonusSec;
  }

  press(): void {
    this.held = true;
    this.bufferLeft = this.cfg.jumpBufferSec;
  }

  release(): void {
    this.held = false;
  }

  stun(sec: number): void {
    this.stunLeft = Math.max(this.stunLeft, sec);
    this.speed = 0;
    this.bufferLeft = 0;
  }

  shift(dx: number): void {
    this.x += dx;
  }

  update(dt: number): void {
    this.justJumped = 0;
    this.justLanded = false;
    this.glideStarted = false;
    this.glideEnded = false;

    if (this.stunLeft > 0) {
      this.stunLeft = Math.max(0, this.stunLeft - dt);
    } else if (this.speed < this.targetSpeed) {
      this.speed = Math.min(this.targetSpeed, this.speed + this.cfg.accel * dt);
    } else {
      this.speed = this.targetSpeed;
    }
    this.x += this.speed * dt;

    if (this.bufferLeft > 0 && !this.stunned) this.tryJump();
    this.bufferLeft = Math.max(0, this.bufferLeft - dt);

    const wasGliding = this.gliding;
    this.gliding = !this.grounded && this.held && !this.stunned && this.vy >= 0 && this.stamina > 0;
    this.glideStarted = this.gliding && !wasGliding;
    this.glideEnded = !this.gliding && wasGliding;

    if (this.gliding) {
      this.vy = Math.min(this.vy + this.glide.gravity * dt, this.glide.maxFallSpeed);
      this.stamina = Math.max(0, this.stamina - dt);
    } else {
      this.vy += this.cfg.gravity * dt;
    }
    this.y += this.vy * dt;

    if (this.y >= this.groundY) {
      this.y = this.groundY;
      this.vy = 0;
      this.jumpsUsed = 0;
      if (!this.grounded) this.justLanded = true;
      this.grounded = true;
    }

    if (this.grounded) {
      this.stamina = Math.min(this.staminaMax, this.stamina + this.glide.regenPerSec * dt);
    }
  }

  private tryJump(): void {
    if (this.grounded) {
      this.vy = -this.cfg.jumpVelocity;
      this.grounded = false;
      this.jumpsUsed = 1;
    } else if (this.jumpsUsed < this.maxJumps) {
      this.vy = -this.cfg.airJumpVelocity;
      this.jumpsUsed++;
    } else {
      return;
    }
    this.bufferLeft = 0;
    this.justJumped = this.jumpsUsed;
  }
}
