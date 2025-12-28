"use strict";
// Copyright (c) 2022-2023 Mitchell Adair
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
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
const ws_1 = __importDefault(require("ws"));
const events_1 = __importDefault(require("./events"));
const logger_1 = __importDefault(require("./logger"));
const utils_1 = require("./utils");
const WS_URL = "wss://eventsub.wss.twitch.tv/ws";
class WebSocketClient {
    constructor(wsURL) {
        this._connections = {};
        this._wsURL = WS_URL;
        if (WebSocketClient._instance) {
            return WebSocketClient._instance;
        }
        WebSocketClient._instance = this;
        this._wsURL = wsURL || WS_URL;
    }
    /**
     * Get the ID of a free WebSocket connection
     *
     * @returns a Promise resolving to the ID of a free WebSocket connection
     */
    getFreeConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug("Getting free WebSocket connection");
            const connectionID = Object.keys(this._connections).find(key => Object.keys(this._connections[key].subscriptions).length < 300);
            if (connectionID) {
                logger_1.default.debug(`Found free WebSocket connection "${connectionID}"`);
                return connectionID;
            }
            else {
                if (Object.keys(this._connections).length < 3) {
                    logger_1.default.debug("No free WebSocket connections, creating a new one...");
                    return new Promise(resolve => this._addConnection(resolve));
                }
                else {
                    logger_1.default.debug("No free WebSocket connections, maximum number of connections reached");
                    throw new Error("Maximum number of WebSocket connections reached");
                }
            }
        });
    }
    /**
     * Remove a subscription from our connections
     *
     * @param {string} id the id of the subscription to remove
     */
    removeSubscription(id) {
        // naively delete from ALL connections -- connections without that subscription will be unaffected
        Object.values(this._connections).forEach(connection => {
            delete connection.subscriptions[id];
        });
    }
    /**
     * Add a subscription to a connection
     *
     * @param {string} connectionID the connection id
     * @param {Subscription} subscription the subscription data
     */
    addSubscription(connectionID, { id, type, condition }) {
        this._connections[connectionID].subscriptions[id] = { type, condition };
    }
    /**
     * Get the subscription ID for a type and condition
     *
     * @param {string} type the subscription type
     * @param {Condition} condition the condition
     */
    findSubscriptionID(type, condition) {
        for (const session in this._connections) {
            const connection = this._connections[session];
            const id = Object.keys(connection.subscriptions).find(key => {
                const subscription = connection.subscriptions[key];
                return subscription.type === type && (0, utils_1.objectShallowEquals)(subscription.condition, condition);
            });
            if (id) {
                return id;
            }
        }
    }
    _addConnection(onWelcome, url = this._wsURL) {
        const ws = new ws_1.default(url);
        ws.onmessage = (event) => {
            var _a, _b, _c, _d, _e;
            const message = JSON.parse(event.data.toString());
            const { metadata: { message_type }, payload } = message;
            if (message_type === "session_welcome" && ((_a = payload.session) === null || _a === void 0 ? void 0 : _a.id)) {
                const sessionId = payload.session.id;
                const timeout = payload.session.keepalive_timeout_seconds || 0;
                logger_1.default.debug(`Received welcome message for session "${sessionId}"`);
                ws.resetTimeout = () => {
                    if (ws.keepaliveTimeout) {
                        clearTimeout(ws.keepaliveTimeout);
                    }
                    ws.keepaliveTimeout = setTimeout(() => {
                        events_1.default.fire({ type: 'connection_lost' }, ws.subscriptions);
                        delete this._connections[sessionId];
                    }, timeout * 1000 + 100);
                };
                ws.subscriptions = {};
                this._connections[sessionId] = ws;
                ws.resetTimeout();
                onWelcome(sessionId);
            }
            else if (message_type === "session_keepalive") {
                (_b = ws.resetTimeout) === null || _b === void 0 ? void 0 : _b.call(ws);
            }
            else if (message_type === "session_reconnect" && ((_c = payload.session) === null || _c === void 0 ? void 0 : _c.id)) {
                const sessionId = payload.session.id;
                const reconnectUrl = payload.session.reconnect_url;
                logger_1.default.debug(`Received reconnect message for session "${sessionId}"`);
                this._addConnection(() => {
                    if (ws.keepaliveTimeout) {
                        clearTimeout(ws.keepaliveTimeout);
                    }
                    ws.close();
                }, reconnectUrl || url);
            }
            else if (message_type === "notification") {
                (_d = ws.resetTimeout) === null || _d === void 0 ? void 0 : _d.call(ws);
                const { subscription, event } = payload;
                if (subscription && event) {
                    logger_1.default.log(`Received notification for type ${subscription.type}`);
                    events_1.default.fire(subscription, event);
                }
            }
            else if (message_type === "revocation") {
                (_e = ws.resetTimeout) === null || _e === void 0 ? void 0 : _e.call(ws);
                const { subscription } = payload;
                if (subscription) {
                    logger_1.default.log(`Received revocation notification for subscription id ${subscription.id}`);
                    events_1.default.fire(Object.assign(Object.assign({}, subscription), { type: "revocation" }), subscription);
                    this.removeSubscription(subscription.id);
                }
            }
            else {
                logger_1.default.log(`Unhandled WebSocket message type "${message_type}"`);
            }
        };
        ws.onclose = (event) => {
            const connectionEntry = Object.entries(this._connections).find(([_id, value]) => value === ws) || [];
            const connectionID = connectionEntry === null || connectionEntry === void 0 ? void 0 : connectionEntry[0];
            const { code, reason } = event;
            logger_1.default.debug(`WebSocket connection "${connectionID}" closed. ${code}:${reason}`);
            if (connectionID) {
                delete this._connections[connectionID];
            }
        };
        return ws;
    }
}
exports.default = WebSocketClient;
