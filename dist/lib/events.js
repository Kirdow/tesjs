"use strict";
// Copyright (c) 2020 Mitchell Adair
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("./logger"));
class EventManager {
    constructor() {
        this._events = {};
        this._subscriptionQueue = {};
        if (EventManager._instance) {
            return EventManager._instance;
        }
        EventManager._instance = this;
    }
    fire(sub, data) {
        const handler = this._events[sub.type];
        if (!handler) {
            logger_1.default.warn(`Recieved event for unhandled type: ${sub.type}`);
            return false;
        }
        else {
            handler.call(this, data, sub);
            return true;
        }
    }
    addListener(type, handler) {
        if (typeof (handler) !== 'function') {
            throw TypeError('Event handler must be a function');
        }
        this._events[type] = handler;
        return this;
    }
    removeListener(type) {
        if (this._events[type]) {
            delete this._events[type];
        }
        return this;
    }
    removeAllListeners() {
        this._events = {};
        return this;
    }
    queueSubscription(data, resolve, reject) {
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
        };
        return this;
    }
    resolveSubscription(id) {
        if (!this._subscriptionQueue[id]) {
            return this;
        }
        const { resolve, timeout, data } = this._subscriptionQueue[id];
        clearTimeout(timeout);
        resolve(data);
        delete this._subscriptionQueue[id];
        return this;
    }
}
const instance = new EventManager();
exports.default = instance;
