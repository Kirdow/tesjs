import type { EventSubscription } from './types';
type EventHandler = (data: Record<string, unknown>, subscription: EventSubscription) => void;
declare class EventManager {
    private static _instance;
    private _events;
    private _subscriptionQueue;
    constructor();
    fire(sub: EventSubscription, data: Record<string, unknown>): boolean;
    addListener(type: string, handler: EventHandler): this;
    removeListener(type: string): this;
    removeAllListeners(): this;
    queueSubscription(data: {
        data: Array<{
            id: string;
            [key: string]: unknown;
        }>;
        [key: string]: unknown;
    }, resolve: (value: unknown) => void, reject: (reason: {
        message: string;
        subscriptionID: string;
    }) => void): this;
    resolveSubscription(id: string): this;
}
declare const instance: EventManager;
export default instance;
