"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const whserver_1 = __importDefault(require("./whserver"));
const wsclient_1 = __importDefault(require("./wsclient"));
const events_1 = __importDefault(require("./events"));
const auth_1 = __importDefault(require("./auth"));
const request_1 = __importDefault(require("./request"));
const utils_1 = require("./utils");
const logger_1 = __importDefault(require("./logger"));
const SUBS_API_URL = "https://api.twitch.tv/helix/eventsub/subscriptions";
/**
 * @license
 * Copyright (c) 2020-2023 Mitchell Adair
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */
class TES {
    constructor(config) {
        this.clientID = '';
        this.transportType = 'webhook';
        // TES singleton
        if (TES._instance) {
            return TES._instance;
        }
        // ensure we have an identity
        if (!config.identity) {
            throw new Error("TES config must contain 'identity'");
        }
        if (!config.listener) {
            throw new Error("TES config must contain 'listener'");
        }
        const { identity: { id, secret, onAuthenticationFailure, accessToken, refreshToken }, listener: { type, baseURL, secret: whSecret, port, ignoreDuplicateMessages, ignoreOldMessages, server, websocketURL, }, } = config;
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
        }
        else {
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
            this.whserver = (0, whserver_1.default)(server, whSecret, serverConfig);
            this._whserverlistener = server ? undefined : this.whserver.listen(this.port);
        }
        else {
            this.wsclient = new wsclient_1.default(websocketURL);
        }
        config.options = config.options || {};
        config.options.debug && logger_1.default.setLevel("debug");
        config.options.logging === false && logger_1.default.setLevel("none");
        new auth_1.default({
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
    getSubscriptions(cursor) {
        logger_1.default.debug(`Getting ${cursor ? `subscriptions for cursor ${cursor}` : "first page of subscriptions"}`);
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
    getSubscriptionsByType(type, cursor) {
        logger_1.default.debug(`Getting ${cursor ? `subscriptions for cursor ${cursor}` : "first page of subscriptions"} of type ${type}`);
        return this._getSubs(`${SUBS_API_URL}?${`type=${encodeURIComponent(type)}`}${cursor ? `&after=${cursor}` : ""}`);
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
    getSubscriptionsByStatus(status, cursor) {
        logger_1.default.debug(`Getting ${cursor ? `subscriptions for cursor ${cursor}` : "first page of subscriptions"} with status ${status}`);
        return this._getSubs(`${SUBS_API_URL}?${`status=${encodeURIComponent(status)}`}${cursor ? `&after=${cursor}` : ""}`);
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
    getSubscription(idOrType, condition) {
        return __awaiter(this, void 0, void 0, function* () {
            if (condition) {
                logger_1.default.debug(`Getting subscription for type ${idOrType} and condition ${(0, utils_1.printObject)(condition)}`);
            }
            else {
                logger_1.default.debug(`Getting subscription for id ${idOrType}`);
            }
            let sub;
            const getUntilFound = (cursor) => __awaiter(this, void 0, void 0, function* () {
                let res;
                if (condition) {
                    res = yield this.getSubscriptionsByType(idOrType, cursor);
                }
                else {
                    res = yield this.getSubscriptions(cursor);
                }
                const { data, pagination } = res;
                sub = data.find(s => {
                    if (condition) {
                        return s.type === idOrType && (0, utils_1.objectShallowEquals)(s.condition, condition);
                    }
                    else {
                        return s.id === idOrType;
                    }
                });
                if (!sub && pagination.cursor) {
                    yield getUntilFound(pagination.cursor);
                }
            });
            yield getUntilFound();
            return sub;
        });
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
    subscribe(type_1, condition_1) {
        return __awaiter(this, arguments, void 0, function* (type, condition, version = "1") {
            var _a, _b;
            logger_1.default.debug(`Subscribing to topic with type ${type} and condition ${(0, utils_1.printObject)(condition)}`);
            const token = yield auth_1.default.getInstance().getToken();
            logger_1.default.debug(`Successfully waited for token`);
            const headers = {
                "client-id": this.clientID,
                Authorization: `Bearer ${token}`,
                "content-type": "application/json",
            };
            let transport = {
                method: this.transportType,
            };
            if (this.transportType === "webhook") {
                transport.callback = `${this.baseURL}/teswh/event`;
                transport.secret = this.whSecret;
            }
            else {
                const session = yield ((_a = this.wsclient) === null || _a === void 0 ? void 0 : _a.getFreeConnection());
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
            const data = yield request_1.default.request(SUBS_API_URL, {
                method: "POST",
                body: JSON.stringify(body),
                headers,
            });
            if (data.data) {
                if (this.transportType === "webhook") {
                    return new Promise((resolve, reject) => events_1.default.queueSubscription(Object.assign(Object.assign({}, data), { data: data.data }), resolve, reject));
                }
                else {
                    const subscription = data.data[0];
                    (_b = this.wsclient) === null || _b === void 0 ? void 0 : _b.addSubscription(subscription.transport.session_id || '', subscription);
                    return subscription;
                }
            }
            else {
                const { error, status, message } = data;
                throw new Error(`${status} ${error}: ${message}`);
            }
        });
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
    unsubscribe(idOrType, condition) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const token = yield auth_1.default.getInstance().getToken();
            const headers = {
                "client-id": this.clientID,
                Authorization: `Bearer ${token}`,
            };
            const unsub = (id) => __awaiter(this, void 0, void 0, function* () {
                return request_1.default.request(`${SUBS_API_URL}?id=${id}`, { method: "DELETE", headers }, false);
            });
            if (condition) {
                logger_1.default.debug(`Unsubscribing from topic with type ${idOrType} and condition ${(0, utils_1.printObject)(condition)}`);
                let id;
                if (this.transportType === "webhook") {
                    const sub = yield this.getSubscription(idOrType, condition);
                    if (sub) {
                        id = sub.id;
                    }
                }
                else {
                    id = (_a = this.wsclient) === null || _a === void 0 ? void 0 : _a.findSubscriptionID(idOrType, condition);
                }
                if (id) {
                    if (this.transportType === "webhook") {
                        return unsub(id);
                    }
                    else {
                        const res = yield unsub(id);
                        if (res.ok) {
                            (_b = this.wsclient) === null || _b === void 0 ? void 0 : _b.removeSubscription(id);
                        }
                        return res;
                    }
                }
                else {
                    throw new Error("subscription with given type and condition not found");
                }
            }
            else {
                logger_1.default.debug(`Unsubscribing from topic ${idOrType}`);
                return unsub(idOrType);
            }
        });
    }
    on(type, callback) {
        logger_1.default.debug(`Adding notification listener for type ${type}`);
        events_1.default.addListener(type, callback);
    }
    _getSubs(url) {
        return __awaiter(this, void 0, void 0, function* () {
            const token = yield auth_1.default.getInstance().getToken();
            const headers = {
                "client-id": this.clientID,
                Authorization: `Bearer ${token}`
            };
            return request_1.default.request(url, { headers });
        });
    }
    static ignoreInMiddleware(middleware) {
        return (req, res, next) => {
            return req.path === "/teswh/event" ? next() : middleware(req, res, next);
        };
    }
}
exports.default = TES;
