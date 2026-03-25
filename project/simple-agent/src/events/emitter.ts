export interface EventRecord<T = unknown> {
  timestamp: number;
  event: string;
  data: T;
}

export class EventEmitter<T = unknown> {
  private handlers: Map<string, Set<(data: T) => void>> = new Map();
  private history: EventRecord<T>[] = [];

  emit(event: string, data: T): void {
    this.history.push({
      timestamp: Date.now(),
      event,
      data,
    });

    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (e) {
          console.error(`Handler error for event ${event}:`, e);
        }
      });
    }
  }

  on(event: string, handler: (data: T) => void): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: (data: T) => void): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  getHistory(): EventRecord[] {
    return [...this.history];
  }
}
