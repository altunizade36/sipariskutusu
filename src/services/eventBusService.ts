export type EventCallback<T = any> = (data: T) => void;
export type EventFilter<T = any> = (data: T) => boolean;

export interface EventSubscription {
  id: string;
  event: string;
  callback: EventCallback;
  filter?: EventFilter;
  once?: boolean;
}

export class EventBus {
  private static subscriptions: Map<string, EventSubscription[]> = new Map();
  private static eventHistory: Map<string, any> = new Map();
  private static maxHistorySize = 100;

  static subscribe<T = any>(
    event: string,
    callback: EventCallback<T>,
    options: { filter?: EventFilter<T>; once?: boolean } = {},
  ): string {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const subscription: EventSubscription = {
      id,
      event,
      callback,
      filter: options.filter,
      once: options.once || false,
    };

    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, []);
    }

    this.subscriptions.get(event)!.push(subscription);
    return id;
  }

  static unsubscribe(subscriptionId: string): boolean {
    for (const [, subs] of this.subscriptions) {
      const index = subs.findIndex((s) => s.id === subscriptionId);
      if (index !== -1) {
        subs.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  static unsubscribeAll(event: string): number {
    const subs = this.subscriptions.get(event);
    if (!subs) return 0;

    const count = subs.length;
    this.subscriptions.delete(event);
    return count;
  }

  static emit<T = any>(event: string, data: T): void {
    // Store in history
    this.eventHistory.set(event, { data, timestamp: Date.now() });
    if (this.eventHistory.size > this.maxHistorySize) {
      const firstKey = this.eventHistory.keys().next().value;
      this.eventHistory.delete(firstKey);
    }

    // Call subscribers
    const subs = this.subscriptions.get(event);
    if (!subs) return;

    const toRemove: string[] = [];

    subs.forEach((sub) => {
      try {
        // Check filter
        if (sub.filter && !sub.filter(data)) {
          return;
        }

        sub.callback(data);

        if (sub.once) {
          toRemove.push(sub.id);
        }
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });

    // Remove one-time subscriptions
    toRemove.forEach((id) => this.unsubscribe(id));
  }

  static once<T = any>(
    event: string,
    callback: EventCallback<T>,
    filter?: EventFilter<T>,
  ): string {
    return this.subscribe(event, callback, { once: true, filter });
  }

  static getLastEvent<T = any>(event: string): T | undefined {
    const entry = this.eventHistory.get(event);
    return entry?.data;
  }

  static getSubscriberCount(event: string): number {
    return this.subscriptions.get(event)?.length || 0;
  }

  static getAllSubscriberCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [event, subs] of this.subscriptions) {
      counts[event] = subs.length;
    }
    return counts;
  }

  static clear(event?: string): void {
    if (event) {
      this.subscriptions.delete(event);
      this.eventHistory.delete(event);
    } else {
      this.subscriptions.clear();
      this.eventHistory.clear();
    }
  }

  static getStats() {
    let totalSubscriptions = 0;
    for (const subs of this.subscriptions.values()) {
      totalSubscriptions += subs.length;
    }

    return {
      events: this.subscriptions.size,
      subscriptions: totalSubscriptions,
      history: this.eventHistory.size,
    };
  }
}

// Predefined app events
export class AppEvents {
  static readonly USER_LOGIN = 'app:user:login';
  static readonly USER_LOGOUT = 'app:user:logout';
  static readonly USER_PROFILE_UPDATED = 'app:user:profile:updated';
  static readonly PRODUCT_ADDED = 'app:product:added';
  static readonly PRODUCT_UPDATED = 'app:product:updated';
  static readonly PRODUCT_DELETED = 'app:product:deleted';
  static readonly FAVORITE_ADDED = 'app:favorite:added';
  static readonly FAVORITE_REMOVED = 'app:favorite:removed';
  static readonly CART_UPDATED = 'app:cart:updated';
  static readonly ORDER_CREATED = 'app:order:created';
  static readonly ORDER_UPDATED = 'app:order:updated';
  static readonly MESSAGE_RECEIVED = 'app:message:received';
  static readonly NOTIFICATION_RECEIVED = 'app:notification:received';
  static readonly NETWORK_ONLINE = 'app:network:online';
  static readonly NETWORK_OFFLINE = 'app:network:offline';
  static readonly APP_STATE_CHANGED = 'app:state:changed';
  static readonly DEEP_LINK_RECEIVED = 'app:deeplink:received';
}
