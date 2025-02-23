// Copyright (c) 2020-2023 Mitchell Adair
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { Express, Request, Response, NextFunction } from 'express'
import express from 'express'
import crypto from 'crypto'
import EventManager from './events'
import Logger from './logger'
import type { Subscription } from './types'

interface WebhookConfig {
    ignoreDuplicateMessages: boolean
    ignoreOldMessages: boolean
}

interface WebhookRequest extends Request {
    valid_signature?: boolean
    headers: {
        'twitch-eventsub-message-signature'?: string
        'twitch-eventsub-message-id'?: string
        'twitch-eventsub-message-timestamp'?: string
        'twitch-eventsub-message-type'?: string
    } & Request['headers']
}

const verifySignature = (secret: string) => {
    return (req: WebhookRequest, res: Response, next: NextFunction): void => {
        Logger.debug("Verifying webhook request");
        req.valid_signature = false;

        const rawBody = (req as any).rawBody

        if (req.headers && req.headers["twitch-eventsub-message-signature"]) {
            Logger.debug("Request contains message signature, calculating verification signature");

            const id = req.headers["twitch-eventsub-message-id"];
            const timestamp = req.headers["twitch-eventsub-message-timestamp"];
            const [algo, signature] = req.headers["twitch-eventsub-message-signature"].split("=");

            const calculatedSignature = crypto
                .createHmac(algo, secret)
                .update(`${id}${timestamp}${rawBody}`)
                .digest('hex')

            if (crypto.timingSafeEqual(Buffer.from(calculatedSignature), Buffer.from(signature))) {
                Logger.debug("Request message signature match");
                req.valid_signature = true;
                next()
                return
            }

            Logger.debug(
                `Request message signature ${signature} does not match calculated signature ${calculatedSignature}`
            );
            res.status(403).send("Request signature mismatch");
            return
        }

        Logger.debug("Received unauthorized request to webhooks endpoint");
        res.status(401).send("Unauthorized request to EventSub webhook");
    };
}

const rawBodyMiddleware = (req: Request, res: Response, next: NextFunction) => {
    let data = ''
    req.on('data', (chunk: string) => {
        data += chunk
    })

    req.on('end', () => {
        ;(req as any).rawBody = data
        Logger.debug(`RawBody: ${data}`)
        next()
    })
}

export default function createWebhookServer(
    server?: Express,
    secret?: string,
    config: Partial<WebhookConfig> = {}
): Express {
    if (!secret) {
        throw new Error('Secret is required for webhook server')
    }

    const whserver: Express = server || express()
    const recentMessageIds: Record<string, boolean> = {}

    const defaultConfig: WebhookConfig = {
        ignoreDuplicateMessages: true,
        ignoreOldMessages: true,
        ...config
    }



    whserver.post(
        '/teswh/event',
        rawBodyMiddleware,
        express.json(),
        verifySignature(secret),
        (req: WebhookRequest, res: Response) => {
            Logger.debug("Incoming webhook event request")
            if (!req.valid_signature) {
                Logger.debug("Incoming webhook event request was not valid")
                return
            }

            const body = req.body as {
                challenge?: string
                subscription: Subscription
                event?: Record<string, unknown>
            }

            const { challenge, subscription, event } = body
            
            const messageType = req.headers['twitch-eventsub-message-type']
            if (challenge && messageType == 'webhook_callback_verification') {
                Logger.log(
                    `Received challenge for ${subscription.type}, ${subscription.id}. Returning challenge.`
                )
                res.status(200).type("text/plain").send(encodeURIComponent(challenge))
                EventManager.resolveSubscription(subscription.id)
                return
            }

            res.status(200).send('OK')

            const messageId = req.headers['twitch-eventsub-message-id']
            if (messageId) {
                if (defaultConfig.ignoreDuplicateMessages && recentMessageIds[messageId]) {
                    Logger.debug(`Received duplicate notification with message id ${messageId}`)
                    return
                }
            
                const messageAge = Date.now() - new Date(req.headers['twitch-eventsub-message-timestamp'] || '').getTime()
                if (defaultConfig.ignoreOldMessages && messageAge > 600000) {
                    Logger.debug(`Received old notification with message id ${messageId}`)
                    return
                }

                switch (messageType) {
                    case 'notification':
                        Logger.log(`Received notification for type ${subscription.type}`)
                        recentMessageIds[messageId] = true
                        setTimeout(() => {
                            delete recentMessageIds[messageId]
                        }, 601000)
                        if (event) {
                            EventManager.fire(subscription, event)
                        }
                        break
                    case 'revocation':
                        Logger.log(`Received revocation notification for subscription id ${subscription.id}`)
                        recentMessageIds[messageId] = true
                        setTimeout(() => {
                            delete recentMessageIds[messageId]
                        }, 601000)
                        EventManager.fire({ ...subscription, type: 'revocation' }, subscription as unknown as Record<string, unknown>)
                        break
                    default:
                        Logger.log(`Received request with unhandled message type ${messageType}`)
                        break
                }
            }
        }
    )

    return whserver
}