"use strict";
// Copyright (c) 2022 Mitchell Adair
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
const logger_1 = __importDefault(require("./logger"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const AUTH_API_URL = "https://id.twitch.tv/oauth2";
class AuthManager {
    constructor(config) {
        this._isWebClient = typeof (window) !== 'undefined';
        this._clientID = '';
        if (!config.onAuthFailure) {
            if (!this._isWebClient && (!config.clientID || !config.clientSecret)) {
                throw new Error("AuthManager config must contain client ID and secret if onAuthFailure not defined");
            }
        }
        if (AuthManager._instance) {
            return AuthManager._instance;
        }
        AuthManager._instance = this;
        this._clientID = config.clientID;
        this._clientSecret = config.clientSecret;
        this._customRefresh = config.onAuthFailure;
        this._refreshToken = config.refreshToken;
        if (config.initialToken) {
            this._authToken = config.initialToken;
            this._resetValidationInterval();
        }
        else {
            this.refreshToken();
        }
    }
    static getInstance() {
        return AuthManager._instance;
    }
    /**
     * Gets the current authentication token.  This will wait until the
     * auth token exists before returning.  The auth token will be undefined
     * in the cases of app startup (until initial fetch/refresh) and token
     * refresh.  If getting the token takes longer than 1000 seconds,
     * something catastrophic is up and it will reject.
     *
     * @returns a promise that resolves the current token
     */
    getToken() {
        return new Promise((resolve, reject) => {
            const start = new Date();
            const retry = () => {
                if (this._authToken) {
                    resolve(this._authToken);
                }
                else if (new Date().getTime() - start.getTime() > 1000000) {
                    const message = "Timed out trying to get token";
                    logger_1.default.error(`${message}.  Something catastrophic has happened!`);
                    reject(message);
                }
                else {
                    logger_1.default.debug("Waiting for token");
                    setTimeout(() => retry(), 10000);
                }
            };
            retry();
        });
    }
    /**
     * Refreshes the authentication token
     */
    refreshToken() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug("Getting new app access token");
            try {
                this._authToken = undefined; // set current token undefined to prevent API calls from using stale token
                // if we have a custom refresh function passed through onAuthenticationFailure, use that
                if (this._isWebClient) {
                    throw new Error('cannot refresh access token on web client');
                }
                else if (this._customRefresh) {
                    this._authToken = yield this._customRefresh();
                }
                else {
                    let refreshSnippet = '';
                    let grantType = 'client_credentials';
                    if (this._refreshToken) {
                        grantType = 'refresh_token';
                        refreshSnippet = `&refresh_token=${this._refreshToken}`;
                    }
                    logger_1.default.debug("Requesting token");
                    const res = yield (0, node_fetch_1.default)(`${AUTH_API_URL}/token?client_id=${this._clientID}&client_secret=${this._clientSecret}&grant_type=${grantType}${refreshSnippet}`, { method: "POST" });
                    logger_1.default.debug("Got token");
                    if (res.ok) {
                        logger_1.default.debug("Getting token json");
                        const { access_token, refresh_token } = yield res.json();
                        logger_1.default.debug("Got token json. Has auth token: " + (!!access_token));
                        this._authToken = access_token;
                        this._refreshToken = refresh_token;
                        this._resetValidationInterval();
                    }
                    else {
                        logger_1.default.debug("Failed to get access token");
                        const { message } = yield res.json();
                        throw new Error(message);
                    }
                }
            }
            catch (err) {
                if (err instanceof Error) {
                    logger_1.default.error(`Error refreshing app access token: ${err.message}`);
                }
                else {
                    logger_1.default.error(`Error refreshing app access token: ${err}`);
                }
                throw err;
            }
        });
    }
    _validateToken() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.default.debug("Validating app access token");
            const headers = {
                "client-id": this._clientID,
                Authorization: `Bearer ${this._authToken}`,
            };
            const res = yield (0, node_fetch_1.default)(`${AUTH_API_URL}/validate`, { headers });
            if (res.status === 401) {
                logger_1.default.debug("Access token not valid, refreshing...");
                yield this.refreshToken();
            }
        });
    }
    _resetValidationInterval() {
        clearInterval(this._validationInterval);
        this._validationInterval = setInterval(this._validateToken.bind(this), 3600000);
    }
}
exports.default = AuthManager;
