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
const node_fetch_1 = __importDefault(require("node-fetch"));
const auth_1 = __importDefault(require("./auth"));
const logger_1 = __importDefault(require("./logger"));
const _browser = typeof (global) !== 'undefined' ? global : typeof (window) !== 'undefined' ? window : {};
class RequestManager {
    constructor() {
        this._fetch = _browser.fetch || node_fetch_1.default;
        if (RequestManager._instance) {
            return RequestManager._instance;
        }
        RequestManager._instance = this;
    }
    static getInstance() {
        return RequestManager._instance;
    }
    /**
     *
     * @param {string} url the url to fetch
     * @param {object} config fetch config object
     * @param {boolean} json whether or not to parse response as JSON
     *                       if false, parse as text
     */
    request(url_1, config_1) {
        return __awaiter(this, arguments, void 0, function* (url, config, json = true) {
            const r = () => __awaiter(this, void 0, void 0, function* () {
                const res = yield this._fetch(url, config);
                if (res.status === 401) {
                    logger_1.default.debug("Request received 401 unauthorized response. Refreshing token and retrying...");
                    const auth = auth_1.default.getInstance();
                    try {
                        yield auth.refreshToken();
                    }
                    catch (err) {
                        if (err instanceof Error && !err.message.includes("web client")) {
                            throw err;
                        }
                        return res.json();
                    }
                    config.headers.Authorization = `Bearer ${yield auth.getToken()}`;
                    return r();
                }
                else {
                    return json ? res.json() : res.text();
                }
            });
            return r();
        });
    }
}
RequestManager._instance = new RequestManager();
const instance = RequestManager.getInstance();
exports.default = instance;
