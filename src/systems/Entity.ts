import { ZERO, type Decimal } from '../core/BigNum';

export type EntityKind = 'coin' | 'obstacle' | 'enemy' | 'pickup';

/**
 * Объект на трассе. Координаты — центр AABB в мировых пикселях.
 * Экземпляры переиспользуются через EntityPool, поэтому все поля сбрасываются в reset().
 */
export class Entity {
  id = 0;
  kind: EntityKind = 'coin';
  /** Ключ в enemies.json / biomes.obstacles; для монет пустой. */
  type = '';
  x = 0;
  y = 0;
  w = 0;
  h = 0;
  /** Время жизни, с. */
  t = 0;
  baseY = 0;
  hp = 0;
  /** Награда, начисленная при сборе/убийстве (заполняется перед событием). */
  reward: Decimal = ZERO;
  /** Препятствие задето / враг столкнулся с героем — больше не опасен. */
  spent = false;
  /** Препятствие чисто перепрыгнуто. */
  cleared = false;
  /** Монета летит к герою (магнит). */
  magnet = false;
  /** Время с последнего удара по врагу, с (для визуального отклика). */
  hurtT = Infinity;
  /** Иллюзорная тварь (низкий рассудок): безвредна, без награды, исчезает от удара. */
  illusion = false;
  /** Препятствие невидимо до последнего момента (рассудок ниже invisibleAt). */
  hidden = false;
  /** Кот уже зашипел на эту иллюзию. */
  hissed = false;
  /** Эссенция, начисленная за убийство (заполняется перед событием kill). */
  essence = 0;

  reset(id: number, kind: EntityKind, type: string): this {
    this.id = id;
    this.kind = kind;
    this.type = type;
    this.x = this.y = this.w = this.h = this.t = this.baseY = this.hp = 0;
    this.reward = ZERO;
    this.spent = this.cleared = this.magnet = false;
    this.illusion = this.hidden = this.hissed = false;
    this.essence = 0;
    this.hurtT = Infinity;
    return this;
  }
}

export class EntityPool {
  private readonly free: Entity[] = [];
  private nextId = 1;
  /** Сколько объектов создано всего — для тестов на отсутствие утечек. */
  created = 0;

  acquire(kind: EntityKind, type: string): Entity {
    let e = this.free.pop();
    if (!e) {
      e = new Entity();
      this.created++;
    }
    return e.reset(this.nextId++, kind, type);
  }

  release(e: Entity): void {
    this.free.push(e);
  }
}

export function overlaps(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return Math.abs(ax - bx) * 2 < aw + bw && Math.abs(ay - by) * 2 < ah + bh;
}
