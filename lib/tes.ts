import type { Express, RequestHandler } from 'express'
import whserver from './whserver'
import WebSocketClient from './wsclient'
import EventManager from './events'
import AuthManager from './auth'
import RequestManager from './request'
import { objectShallowEquals, printObject } from './utils'
import Logger from './logger'
import type { TESConfig, Subscription, EventSubscription, TransportType } from './types'

const SUBS_API_URL = "https://api.twitch.tv/helix/eventsub/subscriptions";

/**
 * @license
 * Copyright (c) 2020-2023 Mitchell Adair
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */
class TES {
    private static _instance: TES
    private clientID: string = ''
    private transportType: TransportType = 'webhook'
    private baseURL?: string
    private whSecret?: string
    private port?: number
    private whserver?: Express
    private _whserverlistener?: ReturnType<Express['listen']>
    private wsclient?: WebSocketClient

    constructor(config: TESConfig) {
        // TES singleton
        if (TES._instance) {
            return TES._instance
        }

        // ensure we have an identity
        if (!config.identity) {
            throw new Error("TES config must contain 'identity'");
        }
        if (!config.listener) {
            throw new Error("TES config must contain 'listener'");
        }

        const {
            identity: { id, secret, onAuthenticationFailure, accessToken, refreshToken },
            listener: {
                type,
                baseURL,
                secret: whSecret,
                port,
                ignoreDuplicateMessages,
                ignoreOldMessages,
                server,
                websocketURL,
            },
        } = config;

        if (!type || (type !== "webhook" && type !== "websocket")) {
            throw new Error("TES listener config must have 'type' either 'webhook' or 'websocket'");
        }
        if (!id) {
            throw new Error("TES identity config must contain 'id'");
        }
        if (type === "webhook") {
            if (!secret) {
                throw new Error("TES identity config must contain 'secret'");
            }
            if (!baseURL) {
                throw new Error("TES listener config must contain 'baseURL'");
            }
            if (!whSecret) {
                throw new Error("TES listener config must contain 'secret'");
            }
        } else {
            if (!accessToken) {
                throw new Error("TES identity config must contain 'accessToken'");
            }
            if (typeof window === "undefined" && !onAuthenticationFailure && !refreshToken) {
                throw new Error("TES identity config must contain either 'onAuthenticationFailure' or 'refreshToken'");
            }
            if (refreshToken && !secret) {
                throw new Error("TES identity config must contain 'secret'");
            }
        }

        TES._instance = this;

        this.clientID = id;
        this.transportType = type;

        if (type === "webhook") {
            this.baseURL = baseURL;
            this.whSecret = whSecret;

            this.port = port || (process.env.PORT ? parseInt(process.env.PORT) : 8080);
            const serverConfig = {
                ignoreDuplicateMessages: ignoreDuplicateMessages === false ? false : true,
                ignoreOldMessages: ignoreOldMessages === false ? false : true,
            };
            this.whserver = whserver(server, whSecret, serverConfig);
            this._whserverlistener = server ? undefined : this.whserver.listen(this.port);
        } else {
            this.wsclient = new WebSocketClient(websocketURL);
        }

        config.options = config.options || {};
        config.options.debug && Logger.setLevel("debug");
        config.options.logging === false && Logger.setLevel("none");

        new AuthManager({
            clientID: id,
            clientSecret: secret,
            onAuthFailure: onAuthenticationFailure,
            initialToken: accessToken,
            refreshToken
        });
    }

    /**
     * Get a list of your event subscriptions
     *
     * @param {string} [cursor] The pagination cursor
     * @returns {Promise} Subscription data. See [Twitch doc](https://dev.twitch.tv/docs/api/reference/#get-eventsub-subscriptions) for details
     * @example
     * ```js
     * const subs = await tes.getSubscriptions();
     * console.log(`I have ${subs.total} event subscriptions`);
     * ```
     */
    getSubscriptions(cursor?: string): Promise<{
        data: Subscription[]
        total: number
        total_cost: number
        max_total_cost: number
        pagination: { cursor?: string }
    }> {
        Logger.debug(`Getting ${cursor ? `subscriptions for cursor ${cursor}` : "first page of subscriptions"}`);
        return this._getSubs(`${SUBS_API_URL}${cursor ? `?after=${cursor}` : ""}`);
    }

    /**
     * Get a list of your event subscriptions by type
     *
     * @param {string} type The type of subscription. See [Twitch doc](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#subscription-types) for details
     * @param {string} [cursor] The pagination cursor
     * @returns {Promise} Subscription data. See [Twitch doc](https://dev.twitch.tv/docs/api/reference/#get-eventsub-subscriptions) for details
     * @example
     * ```js
     * const subs = await tes.getSubscriptionsByType("channel.update");
     * console.log(`I have ${subs.total} "channel.update" event subscriptions`);
     * ```
     */
    getSubscriptionsByType(type: string, cursor?: string): Promise<{
        data: Subscription[]
        total: number
        total_cost: number
        max_total_cost: number
        pagination: { cursor?: string }
    }> {
        Logger.debug(
            `Getting ${cursor ? `subscriptions for cursor ${cursor}` : "first page of subscriptions"} of type ${type}`
        );
        return this._getSubs(
            `${SUBS_API_URL}?${`type=${encodeURIComponent(type)}`}${cursor ? `&after=${cursor}` : ""}`
        );
    }

    /**
     * Get a list of your event subscriptions by status
     *
     * @param {string} status The subscription status. See [Twitch doc](https://dev.twitch.tv/docs/api/reference/#get-eventsub-subscriptions) for details
     * @param {string} [cursor] The pagination cursor
     * @returns {Promise} Subscription data. See [Twitch doc](https://dev.twitch.tv/docs/api/reference/#get-eventsub-subscriptions) for details
     * @example
     * ```js
     * const subs = await tes.getSubscriptionsByStatus("enabled");
     * console.log(`I have ${subs.total} "enabled" event subscriptions`);
     * ```
     */
    getSubscriptionsByStatus(status: string, cursor?: string): Promise<{
        data: Subscription[]
        total: number
        total_cost: number
        max_total_cost: number
        pagination: { cursor?: string }
    }> {
        Logger.debug(
            `Getting ${
                cursor ? `subscriptions for cursor ${cursor}` : "first page of subscriptions"
            } with status ${status}`
        );
        return this._getSubs(
            `${SUBS_API_URL}?${`status=${encodeURIComponent(status)}`}${cursor ? `&after=${cursor}` : ""}`
        );
    }

    /**
     * Get subscription data for an individual subscription. Search either by id or by type and condition
     *
     * @signature `getSubscription(id)`
     * @signature `getSubscription(type, condition)`
     * @param {string} idOrType The subscription id or [type](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#subscription-types)
     * @param {Object} [condition] The subscription condition, required when finding by type. See [Twitch doc](https://dev.twitch.tv/docs/eventsub/eventsub-reference/#conditions) for details
     * @returns {Promise} The subscription data
     * @example
     * Find a subscription by id
     * ```js
     * const sub = await tes.getSubscription("2d9e9f1f-39c3-426d-88f5-9f0251c9bfef");
     * console.log(`The status for subscription ${sub.id} is ${sub.status}`);
     * ```
     * @example
     * Find a subscription by type and condition
     * ```js
     * const condition = { broadcaster_user_id: "1337" };
     * const sub = await tes.getSubscription("channel.update", condition);
     * console.log(`The status for subscription ${sub.id} is ${sub.status}`);
     * ```
     */
    async getSubscription(idOrType: string, condition?: Record<string, unknown>): Promise<Subscription | undefined> {
        if (condition) {
            Logger.debug(`Getting subscription for type ${idOrType} and condition ${printObject(condition)}`);
        } else {
            Logger.debug(`Getting subscription for id ${idOrType}`);
        }

        let sub: Subscription | undefined;
        const getUntilFound = async (cursor?: string) => {
            let res;
            if (condition) {
                res = await this.getSubscriptionsByType(idOrType, cursor);
            } else {
                res = await this.getSubscriptions(cursor);
            }

            const { data, pagination } = res;
            sub = data.find(s => {
                if (condition) {
                    return s.type === idOrType && objectShallowEquals(s.condition, condition);
                } else {
                    return s.id === idOrType;
                }
            });
            if (!sub && pagination.cursor) {
                await getUntilFound(pagination.cursor);
            }
        };
        await getUntilFound();
        return sub;
    }

    /**
     * Subscribe to an event
     *
     * @param {string} type The subscription type. See [Twitch doc](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#subscription-types) for details
     * @param {Object} condition The subscription condition. See [Twitch doc](https://dev.twitch.tv/docs/eventsub/eventsub-reference/#conditions) for details
     * @param {string} [version] The subscription version. See [Twitch doc](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#subscription-types) for details
     * @returns {Promise} A Promise that resolves when subscribing is complete with the subscription data
     * @example
     * ```js
     * const condition = { broadcaster_user_id: "1337" };
     * const sub = tes.subscribe("channel.update", condition);
     * console.log(`Created subscription to ${sub.type}, subscription id ${sub.id}`);
     * ```
     */
    async subscribe(type: string, condition: Record<string, unknown>, version: string = "1"): Promise<Subscription> {
        Logger.debug(`Subscribing to topic with type ${type} and condition ${printObject(condition)}`);
        const token = await AuthManager.getInstance().getToken();
        Logger.debug(`Successfully waited for token`)
        const headers = {
            "client-id": this.clientID,
            Authorization: `Bearer ${token}`,
            "content-type": "application/json",
        };
        let transport: {
            method: TransportType
            callback?: string
            secret?: string
            session_id?: string
        } = {
            method: this.transportType,
        };

        if (this.transportType === "webhook") {
            transport.callback = `${this.baseURL}/teswh/event`;
            transport.secret = this.whSecret;
        } else {
            const session = await this.wsclient?.getFreeConnection();
            if (session) {
                transport.session_id = session;
            }
        }

        const body = {
            type,
            condition,
            transport,
            version,
        };

        const data = await RequestManager.request(SUBS_API_URL, {
            method: "POST",
            body: JSON.stringify(body),
            headers,
        }) as { data?: Subscription[], error?: string, status?: number, message?: string };

        if (data.data) {
            if (this.transportType === "webhook") {
                return new Promise((resolve, reject) => EventManager.queueSubscription({
                    ...data,
                    data: data.data as unknown as Array<{ id: string, [key: string]: unknown }>,
                }, resolve as (value: unknown) => void, reject));
            } else {
                const subscription = data.data[0];
                this.wsclient?.addSubscription(subscription.transport.session_id || '', subscription);
                return subscription;
            }
        } else {
            const { error, status, message } = data;
            throw new Error(`${status} ${error}: ${message}`);
        }
    }

    /**
     * Unsubscribe from an event. Unsubscribe either by id, or by type and condition
     *
     * @signature `unsubscribe(id)`
     * @signature `unsubscribe(type, condition)`
     * @param {string} idOrType The subscription id or [type](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/#subscription-types)
     * @param {Object} [condition] The subscription condition, required when finding by type. See [Twitch doc](https://dev.twitch.tv/docs/eventsub/eventsub-reference/#conditions) for details
     * @returns {Promise} Resolves when unsubscribed
     * @example
     * Unsubscribe by id
     * ```js
     * await tes.unsubscribe("2d9e9f1f-39c3-426d-88f5-9f0251c9bfef");
     * console.log("Successfully unsubscribed");
     * ```
     * @example
     * Unsubscribe by type and condition
     * ```js
     * const condition = { broadcaster_user_id: "1337" };
     * await tes.unsubscribe("channel.update", condition);
     * console.log("Successfully unsubscribed");
     * ```
     */
    async unsubscribe(idOrType: string, condition?: Record<string, unknown>): Promise<Response> {
        const token = await AuthManager.getInstance().getToken();
        const headers = {
            "client-id": this.clientID,
            Authorization: `Bearer ${token}`,
        };
        const unsub = async (id: string): Promise<Response> => {
            return RequestManager.request(`${SUBS_API_URL}?id=${id}`, { method: "DELETE", headers }, false) as Promise<Response>
        };

        if (condition) {
            Logger.debug(`Unsubscribing from topic with type ${idOrType} and condition ${printObject(condition)}`);
            let id: string | undefined;

            if (this.transportType === "webhook") {
                const sub = await this.getSubscription(idOrType, condition);
                if (sub) {
                    id = sub.id;
                }
            } else {
                id = this.wsclient?.findSubscriptionID(idOrType, condition);
            }
            if (id) {
                if (this.transportType === "webhook") {
                    return unsub(id);
                } else {
                    const res = await unsub(id);
                    if (res.ok) {
                        this.wsclient?.removeSubscription(id);
                    }
                    return res;
                }
            } else {
                throw new Error("subscription with given type and condition not found");
            }
        } else {
            Logger.debug(`Unsubscribing from topic ${idOrType}`);
            return unsub(idOrType);
        }
    }

    on(type: string, callback: (event: Record<string, unknown>, subscription: EventSubscription) => void): void {
        Logger.debug(`Adding notification listener for type ${type}`);
        EventManager.addListener(type, callback);
    }

    private async _getSubs(url: string): Promise<{
        data: Subscription[]
        total: number
        total_cost: number
        max_total_cost: number
        pagination: { cursor?: string }
    }> {
        const token = await AuthManager.getInstance().getToken();
        const headers = {
            "client-id": this.clientID,
            Authorization: `Bearer ${token}`
        };

        return RequestManager.request(url, { headers }) as Promise<{
            data: Subscription[]
            total: number
            total_cost: number
            max_total_cost: number
            pagination: { cursor?: string }
        }>;
    }

    static ignoreInMiddleware(middleware: RequestHandler): RequestHandler {
        return (req, res, next) => {
            return req.path === "/teswh/event" ? next() : middleware(req, res, next);
        };
    }
}

export default TES
