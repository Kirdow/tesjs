// Copyright (c) 2020 Mitchell Adair
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { EventSubscription } from './types'
import Logger from './logger'

type EventHandler = (data: Record<string, unknown>, subscription: EventSubscription) => void

interface QueueItem {
    data: {
        data: Array<{
            id: string
            [key: string]: unknown
        }>
        [key: string]: unknown
    }
    resolve: (value: unknown) => void
    timeout: NodeJS.Timeout
}

class EventManager {
    private static _instance: EventManager
    private _events: Record<string, EventHandler> = {}
    private _subscriptionQueue: Record<string, QueueItem> = {}

    constructor() {
        if (EventManager._instance) {
            return EventManager._instance
        }
        EventManager._instance = this;
    }

    fire(sub: EventSubscription, data: Record<string, unknown>): boolean {
        const handler = this._events[sub.type]

        if (!handler) {
            Logger.warn(`Recieved event for unhandled type: ${sub.type}`);
            return false;
        } else {
            handler.call(this, data, sub);
            return true;
        }
    }

    addListener(type: string, handler: EventHandler): this {
        if (typeof(handler) !== 'function') {
            throw TypeError('Event handler must be a function');
        }

        this._events[type] = handler;
        return this;
    }

    public removeListener(type: string): this {
        if (this._events[type]) {
            delete this._events[type];
        }

        return this;
    }

    removeAllListeners(): this {
        this._events = {};
        return this;
    }

    queueSubscription(
        data: {
            data: Array<{
                id: string
                [key: string]: unknown
            }>
            [key: string]: unknown
        },
        resolve: (value: unknown) => void,
        reject: (reason: { message: string, subscriptionID: string }) => void
    ): this {
        const id = data.data[0].id;

        this._subscriptionQueue[id] = {
            data,
            resolve,
            timeout: setTimeout(() => {
                reject({
                    message: 'Subscription verification timed out, this will need to be cleaned up',
                    subscriptionID: id,
                });
                delete this._subscriptionQueue[id];
            }, 600000),
        }

        return this
    }

    resolveSubscription(id: string): this {
        if (!this._subscriptionQueue[id]) {
            return this
        }

        const { resolve, timeout, data } = this._subscriptionQueue[id]
        clearTimeout(timeout);
        resolve(data);
        delete this._subscriptionQueue[id];

        return this;
    }
}

const instance = new EventManager();
export default instance
