// Copyright (c) 2022-2023 Mitchell Adair
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import WebSocket from 'ws'
import EventManager from './events'
import Logger from './logger';
import { objectShallowEquals } from './utils';
import type { WebSocketMessage, WebSocketConnection } from './types'

const WS_URL = "wss://eventsub.wss.twitch.tv/ws";

interface Subscription {
    type: string
    condition: Record<string, unknown>
}

interface Connection extends WebSocketConnection {
    subscriptions: Record<string, Subscription>
}

interface Connections {
    [key: string]: Connection
}

class WebSocketClient {
    private static _instance: WebSocketClient
    private _connections: Connections = {}
    private _wsURL: string = WS_URL
    constructor(wsURL?: string) {
        if (WebSocketClient._instance) {
            return WebSocketClient._instance
        }
        WebSocketClient._instance = this

        this._wsURL = wsURL || WS_URL;
    }

    /**
     * Get the ID of a free WebSocket connection
     *
     * @returns a Promise resolving to the ID of a free WebSocket connection
     */
    async getFreeConnection(): Promise<string> {
        Logger.debug("Getting free WebSocket connection");

        const connectionID = Object.keys(this._connections).find(key =>
            Object.keys(this._connections[key].subscriptions).length < 300
        )

        if (connectionID) {
            Logger.debug(`Found free WebSocket connection "${connectionID}"`)
            return connectionID
        } else {
            if (Object.keys(this._connections).length < 3) {
                Logger.debug("No free WebSocket connections, creating a new one...")
                return new Promise(resolve => this._addConnection(resolve))
            } else {
                Logger.debug("No free WebSocket connections, maximum number of connections reached");
                throw new Error("Maximum number of WebSocket connections reached");
            }
        }
    }

    /**
     * Remove a subscription from our connections
     *
     * @param {string} id the id of the subscription to remove
     */
    removeSubscription(id: string): void {
        // naively delete from ALL connections -- connections without that subscription will be unaffected
        Object.values(this._connections).forEach(connection => {
            delete connection.subscriptions[id]
        })
    }

    /**
     * Add a subscription to a connection
     *
     * @param {string} connectionID the connection id
     * @param {Subscription} subscription the subscription data
     */
    addSubscription(connectionID: string, { id, type, condition }: { id: string, type: string, condition: Record<string, unknown>}): void {
        this._connections[connectionID].subscriptions[id] = { type, condition };
    }

    /**
     * Get the subscription ID for a type and condition
     *
     * @param {string} type the subscription type
     * @param {Condition} condition the condition
     */
    findSubscriptionID(type: string, condition: Record<string, unknown>): string | undefined {
        for (const session in this._connections) {
            const connection = this._connections[session]
            const id = Object.keys(connection.subscriptions).find(key => {
                const subscription = connection.subscriptions[key]
                return subscription.type === type && objectShallowEquals(subscription.condition, condition);
            })
            if (id) {
                return id
            }
        }
    }

    private _addConnection(onWelcome: (id: string) => void, url: string = this._wsURL): WebSocket {
        const ws = new WebSocket(url) as Connection

        ws.onmessage = (event: WebSocket.MessageEvent) => {
            const message = JSON.parse(event.data.toString()) as WebSocketMessage
            const { metadata: { message_type }, payload } = message
            if (message_type === "session_welcome" && payload.session?.id) {
                const sessionId = payload.session.id
                const timeout = payload.session.keepalive_timeout_seconds || 0
                Logger.debug(`Received welcome message for session "${sessionId}"`);

                ws.resetTimeout = () => {
                    if (ws.keepaliveTimeout) {
                        clearTimeout(ws.keepaliveTimeout);
                    }
                    ws.keepaliveTimeout = setTimeout(() => {
                        EventManager.fire(
                            { type: 'connection_lost' },
                            ws.subscriptions as unknown as Record<string, unknown>
                        )
                        delete this._connections[sessionId]
                    }, timeout * 1000 + 100);
                }

                ws.subscriptions = {};
                this._connections[sessionId] = ws;
                ws.resetTimeout();
                onWelcome(sessionId);
            } else if (message_type === "session_keepalive") {
                ws.resetTimeout?.();
            } else if (message_type === "session_reconnect" && payload.session?.id) {
                const sessionId = payload.session.id
                const reconnectUrl = payload.session.reconnect_url
                Logger.debug(`Received reconnect message for session "${sessionId}"`);
                this._addConnection(() => {
                    if (ws.keepaliveTimeout) {
                        clearTimeout(ws.keepaliveTimeout);
                    }
                    ws.close();
                }, reconnectUrl || url);
            } else if (message_type === "notification") {
                ws.resetTimeout?.();
                const { subscription, event } = payload;
                if (subscription && event) {
                    Logger.log(`Received notification for type ${subscription.type}`);
                    EventManager.fire(subscription, event);
                }
            } else if (message_type === "revocation") {
                ws.resetTimeout?.();
                const { subscription } = payload;
                if (subscription) {
                    Logger.log(`Received revocation notification for subscription id ${subscription.id}`);
                    EventManager.fire(
                        { ...subscription, type: "revocation" },
                        subscription as unknown as Record<string, unknown>
                    )
                    this.removeSubscription(subscription.id);
                }
            } else {
                Logger.log(`Unhandled WebSocket message type "${message_type}"`);
            }
        }

        ws.onclose = (event: WebSocket.CloseEvent) => {
            const connectionEntry = Object.entries(this._connections).find(([_id, value]) => value === ws) || []
            const connectionID = connectionEntry?.[0]
            const { code, reason } = event;
            Logger.debug(`WebSocket connection "${connectionID}" closed. ${code}:${reason}`);
            if (connectionID) {
                delete this._connections[connectionID]
            }
        }

        return ws;
    }
}

export default WebSocketClient
