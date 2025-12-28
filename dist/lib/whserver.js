"use strict";
// Copyright (c) 2020-2023 Mitchell Adair
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const crypto_1 = __importDefault(require("crypto"));
const events_1 = __importDefault(require("./events"));
const logger_1 = __importDefault(require("./logger"));
const verify = (secret) => (req, res, buf) => {
    logger_1.default.debug("Verifying webhook request");
    req.valid_signature = false;
    if (req.headers && req.headers["twitch-eventsub-message-signature"]) {
        logger_1.default.debug("Request contains message signature, calculating verification signature");
        const id = req.headers["twitch-eventsub-message-id"];
        const timestamp = req.headers["twitch-eventsub-message-timestamp"];
        const [algo, signature] = req.headers["twitch-eventsub-message-signature"].split("=");
        const calculatedSignature = crypto_1.default
            .createHmac(algo, secret)
            .update(`${id}${timestamp}${buf}`)
            .digest('hex');
        if (crypto_1.default.timingSafeEqual(Buffer.from(calculatedSignature), Buffer.from(signature))) {
            logger_1.default.debug("Request message signature match");
            req.valid_signature = true;
        }
        else {
            logger_1.default.debug(`Request message signature ${signature} does not match calculated signature ${calculatedSignature}`);
            res.status(403).send("Request signature mismatch");
        }
    }
    else {
        logger_1.default.debug("Received unauthorized request to webhooks endpoint");
        res.status(401).send("Unauthorized request to EventSub webhook");
    }
};
function createWebhookServer(server, secret, config = {}) {
    if (!secret) {
        throw new Error('Secret is required for webhook server');
    }
    const whserver = server || (0, express_1.default)();
    const recentMessageIds = {};
    const defaultConfig = Object.assign({ ignoreDuplicateMessages: true, ignoreOldMessages: true }, config);
    whserver.post('/teswh/event', express_1.default.json({ verify: verify(secret) }), (req, res) => {
        if (!req.valid_signature) {
            return;
        }
        const body = req.body;
        const { challenge, subscription, event } = body;
        const messageType = req.headers['twitch-eventsub-message-type'];
        if (challenge && messageType == 'webhook_callback_verification') {
            logger_1.default.log(`Received challenge for ${subscription.type}, ${subscription.id}. Returning challenge.`);
            res.status(200).type("text/plain").send(encodeURIComponent(challenge));
            events_1.default.resolveSubscription(subscription.id);
            return;
        }
        res.status(200).send('OK');
        const messageId = req.headers['twitch-eventsub-message-id'];
        if (messageId) {
            if (defaultConfig.ignoreDuplicateMessages && recentMessageIds[messageId]) {
                logger_1.default.debug(`Received duplicate notification with message id ${messageId}`);
                return;
            }
            const messageAge = Date.now() - new Date(req.headers['twitch-eventsub-message-timestamp'] || '').getTime();
            if (defaultConfig.ignoreOldMessages && messageAge > 600000) {
                logger_1.default.debug(`Received old notification with message id ${messageId}`);
                return;
            }
            switch (messageType) {
                case 'notification':
                    logger_1.default.log(`Received notification for type ${subscription.type}`);
                    recentMessageIds[messageId] = true;
                    setTimeout(() => {
                        delete recentMessageIds[messageId];
                    }, 601000);
                    if (event) {
                        events_1.default.fire(subscription, event);
                    }
                    break;
                case 'revocation':
                    logger_1.default.log(`Received revocation notification for subscription id ${subscription.id}`);
                    recentMessageIds[messageId] = true;
                    setTimeout(() => {
                        delete recentMessageIds[messageId];
                    }, 601000);
                    events_1.default.fire(Object.assign(Object.assign({}, subscription), { type: 'revocation' }), subscription);
                    break;
                default:
                    logger_1.default.log(`Received request with unhandled message type ${messageType}`);
                    break;
            }
        }
    });
    return whserver;
}
exports.default = createWebhookServer;
