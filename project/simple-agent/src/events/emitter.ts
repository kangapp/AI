export interface EventRecord {
  timestamp: number;
  event: string;
  data: any;
}

export class EventEmitter {
  private handlers: Map<string, Set<(data: any) => void>> = new Map();
  private history: EventRecord[] = [];

  emit(event: string, data: any): void {
    this.history.push({
      timestamp: Date.now(),
      event,
      data,
    });

    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  on(event: string, handler: (data: any) => void): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: (data: any) => void): void {
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
