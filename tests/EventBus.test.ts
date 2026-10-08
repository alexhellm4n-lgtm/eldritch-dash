import { describe, expect, it, vi } from 'vitest';
import { EventBus } from '../src/core/EventBus';

interface TestEvents {
  ping: number;
  pong: string;
}

describe('EventBus', () => {
  it('доставляет полезную нагрузку подписчикам', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    bus.on('ping', handler);
    bus.emit('ping', 42);
    expect(handler).toHaveBeenCalledWith(42);
  });

  it('отписка через возвращённую функцию', () => {
    const bus = new EventBus<TestEvents>();
    const handler = vi.fn();
    const off = bus.on('pong', handler);
    off();
    bus.emit('pong', 'x');
    expect(handler).not.toHaveBeenCalled();
  });

  it('отписка внутри обработчика не ломает текущую рассылку', () => {
    const bus = new EventBus<TestEvents>();
    const second = vi.fn();
    const off = bus.on('ping', () => off());
    bus.on('ping', second);
    bus.emit('ping', 1);
    expect(second).toHaveBeenCalledOnce();
  });
});
