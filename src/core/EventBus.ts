/** Карта событий игры: имя → тип полезной нагрузки. Расширяется по мере появления систем. */
export interface GameEvents {
  'game:ready': undefined;
}

type Handler<T> = (payload: T) => void;

/** Типизированная шина событий без зависимостей от Phaser/DOM. */
export class EventBus<Events extends object = GameEvents> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // Set обходится «вживую»: отписка во время рассылки безопасна, а копия списка не нужна.
    for (const handler of set) (handler as Handler<Events[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
