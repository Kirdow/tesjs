import type { RequestHandler } from 'express';
import type { TESConfig, Subscription, EventSubscription } from './types';
/**
 * @license
 * Copyright (c) 2020-2023 Mitchell Adair
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */
declare class TES {
    private static _instance;
    private clientID;
    private transportType;
    private baseURL?;
    private whSecret?;
    private port?;
    private whserver?;
    private _whserverlistener?;
    private wsclient?;
    constructor(config: TESConfig);
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
        data: Subscription[];
        total: number;
        total_cost: number;
        max_total_cost: number;
        pagination: {
            cursor?: string;
        };
    }>;
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
        data: Subscription[];
        total: number;
        total_cost: number;
        max_total_cost: number;
        pagination: {
            cursor?: string;
        };
    }>;
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
        data: Subscription[];
        total: number;
        total_cost: number;
        max_total_cost: number;
        pagination: {
            cursor?: string;
        };
    }>;
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
    getSubscription(idOrType: string, condition?: Record<string, unknown>): Promise<Subscription | undefined>;
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
    subscribe(type: string, condition: Record<string, unknown>, version?: string): Promise<Subscription>;
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
    unsubscribe(idOrType: string, condition?: Record<string, unknown>): Promise<Response>;
    on(type: string, callback: (event: Record<string, unknown>, subscription: EventSubscription) => void): void;
    private _getSubs;
    static ignoreInMiddleware(middleware: RequestHandler): RequestHandler;
}
export default TES;
