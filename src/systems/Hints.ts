import type { EnemyConfig, SanityConfig } from '../config/types';
import type { RunSim } from './RunSim';

/**
 * Подсказки по механикам: разовые, в порядке появления механик. Показанные запоминаются
 * в сохранении (`state.hints`) и больше не повторяются. Тексты — `hint.<id>` в i18n.
 */
export const HINT_IDS = [
  'awakenMeter',
  'stun',
  'combo',
  'flyer',
  'armor',
  'sanity',
  'distortion',
  'hidden',
  'insight',
  'page',
  'awaken',
  'chest',
  'cat',
  'hiss',
  'phase',
  'grimoire',
  'dive',
  'miniBoss',
  'boss',
  'bossEscaped',
  'biome',
  'town',
  'journal',
  'achievement',
] as const;
export type HintId = (typeof HINT_IDS)[number];

/** Что HintWatcher знает о сессии (без зависимости от GameSession — для тестов). */
export interface HintHost {
  queueHint(id: HintId): void;
}

/** Условия, которые проверяются опросом, а не по событию. */
export interface HintPoll {
  /** Хватает Эссенции на доступный сигил, а сигилов ещё нет. */
  grimoireAffordable: boolean;
  canDive: boolean;
  /** Хватает дублонов на постройку городка, а построек ещё нет. */
  townAffordable: boolean;
}

/** Подписывается на события забега и превращает «впервые случилось» в подсказки. */
export class HintWatcher {
  private sim: RunSim | null = null;
  private readonly unsub: (() => void)[] = [];

  constructor(
    private readonly host: HintHost,
    private readonly enemies: Readonly<Record<string, EnemyConfig>>,
    private readonly sanity: SanityConfig,
  ) {}

  attach(sim: RunSim): void {
    this.detach();
    this.sim = sim;
    const q = (id: HintId) => () => this.host.queueHint(id);
    const bus = sim.bus;
    this.unsub.push(
      bus.on('kill', q('awakenMeter')),
      bus.on('stun', q('stun')),
      bus.on('hurt', (e) => {
        if (!e.boss) this.host.queueHint('armor');
      }),
      bus.on('spawn', (e) => {
        if (e.kind === 'enemy' && !e.boss && this.enemies[e.type]?.behavior === 'flyer')
          this.host.queueHint('flyer');
      }),
      bus.on('insightStart', q('insight')),
      bus.on('page', q('page')),
      bus.on('awakenReady', q('awaken')),
      bus.on('chest', q('chest')),
      bus.on('catHiss', q('hiss')),
      bus.on('eliteSpawn', q('miniBoss')),
      bus.on('bossSpawn', q('boss')),
      bus.on('bossEscaped', q('bossEscaped')),
    );
  }

  detach(): void {
    for (const off of this.unsub) off();
    this.unsub.length = 0;
    this.sim = null;
  }

  /** Опрос состояния (раз в полсекунды достаточно). */
  poll(p: HintPoll): void {
    const sim = this.sim;
    if (sim) {
      const v = sim.sanity.value;
      if (v < this.sanity.max * 0.75) this.host.queueHint('sanity');
      if (v < this.sanity.distortAt) this.host.queueHint('distortion');
      if (v < this.sanity.invisibleAt) this.host.queueHint('hidden');
      if (sim.combo.multiplier > 1) this.host.queueHint('combo');
    }
    if (p.grimoireAffordable) this.host.queueHint('grimoire');
    if (p.canDive) this.host.queueHint('dive');
    if (p.townAffordable) this.host.queueHint('town');
  }
}
