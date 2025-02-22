import WebSocket from 'ws'
import type { Express } from 'express'

export type TransportType = 'webhook' | 'websocket'

export interface AuthConfig {
    clientID: string
    clientSecret?: string
    onAuthFailure?: () => Promise<string>
    initialToken?: string
    refreshToken?: string
}

export interface TESConfig {
    options?: {
        debug?: boolean
        logging?: boolean
    }
    identity: {
        id: string
        secret?: string
        onAuthenticationFailure?: () => Promise<string>
        accessToken?: string
        refreshToken?: string
    }
    listener: {
        type: TransportType
        baseURL?: string
        websocketURL?: string
        secret?: string
        server?: Express
        port?: number
        ignoreDuplicateMessages?: boolean
        ignoreOldMessages?: boolean
    }
}

export type SystemEventType = 'connection_lost' | 'revocation'

export interface Subscription {
    id: string
    type: string
    condition: Record<string, unknown>
    transport: {
        method: TransportType
        callback?: string
        secret?: string
        session_id?: string
    }
    version?: string
}

export interface SystemEvent {
    type: SystemEventType
}

export type EventSubscription = Subscription | SystemEvent

export interface EventData {
    subscription: Subscription
    event: Record<string, unknown>
}

export interface WebSocketMessage {
    metadata: {
        message_type: string
        [key: string]: unknown
    }
    payload: {
        session?: {
            id: string
            keepalive_timeout_seconds?: number
            reconnect_url?: string
        }
        subscription?: Subscription
        event?: Record<string, unknown>
        [key: string]: unknown
    }
}

export interface WebSocketConnection extends WebSocket {
    resetTimeout?: () => void
    keepaliveTimeout?: NodeJS.Timeout
    subscriptions: Record<string, {
        type: string
        condition: Record<string, unknown>
    }>
}