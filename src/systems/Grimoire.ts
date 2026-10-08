import type { GrimoireConfig, GrimoireNodeConfig, RunModifiers } from '../config/types';
import { applyEffect } from './Upgrades';

export type NodeState = 'owned' | 'available' | 'locked';

/** Запретный гримуар (SPEC §6): узлы за Эссенцию, связи-требования, часть узлов — за тёмные звёзды. */
export class Grimoire {
  private readonly byId = new Map<string, GrimoireNodeConfig>();

  constructor(readonly cfg: GrimoireConfig) {
    for (const n of cfg.nodes) this.byId.set(n.id, n);
  }

  node(id: string): GrimoireNodeConfig {
    const n = this.byId.get(id);
    if (!n) throw new Error(`Нет узла гримуара ${id}`);
    return n;
  }

  get nodes(): readonly GrimoireNodeConfig[] {
    return this.cfg.nodes;
  }

  /** Узел доступен, если куплены все требования (хотя бы одно, если их несколько — см. ниже) и хватает звёзд. */
  state(id: string, owned: ReadonlySet<string>, darkStars: number): NodeState {
    if (owned.has(id)) return 'owned';
    const n = this.node(id);
    // Достаточно одного купленного «родителя»: дерево ветвится, а не сходится.
    const reqOk = n.requires.length === 0 || n.requires.some((r) => owned.has(r));
    const starsOk = (n.darkStars ?? 0) <= darkStars;
    return reqOk && starsOk ? 'available' : 'locked';
  }

  canBuy(id: string, owned: ReadonlySet<string>, darkStars: number, essence: number): boolean {
    return this.state(id, owned, darkStars) === 'available' && essence >= this.node(id).cost;
  }

  modifiers(owned: Iterable<string>, into: RunModifiers): RunModifiers {
    for (const id of owned) {
      const n = this.byId.get(id);
      if (n) applyEffect(into, n);
    }
    return into;
  }

  /** Узлы, которые переживают Погружение. */
  keptAfterDive(owned: Iterable<string>): string[] {
    return [...owned].filter((id) => this.byId.get(id)?.keep === true);
  }
}
