// Copyright (c) 2022 Mitchell Adair
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import fetch from 'node-fetch'
import type { RequestInit, HeadersInit, Response } from 'node-fetch'
import AuthManager from './auth'
import Logger from './logger'

const _browser = typeof(global) !== 'undefined' ? global : typeof(window) !== 'undefined' ? window: {}

type BrowserFetch = typeof fetch

interface RequestConfig extends RequestInit {
    headers: HeadersInit & {
        Authorization?: string
        'client-id'?: string
    }
}

class RequestManager {
    private static _instance: RequestManager = new RequestManager()
    private _fetch: BrowserFetch = (_browser as any).fetch || fetch

    private constructor() {
        if (RequestManager._instance) {
            return RequestManager._instance
        }
        RequestManager._instance = this;
    }

    static getInstance(): RequestManager {
        return RequestManager._instance
    }

    /**
     *
     * @param {string} url the url to fetch
     * @param {object} config fetch config object
     * @param {boolean} json whether or not to parse response as JSON
     *                       if false, parse as text
     */
    async request(url: string, config: RequestConfig, json: boolean = true): Promise<unknown> {
        const r = async (): Promise<unknown> => {
            const res: Response = await this._fetch(url, config);
            if (res.status === 401) {
                Logger.debug("Request received 401 unauthorized response. Refreshing token and retrying...");
                const auth = AuthManager.getInstance();
                try {
                    await auth.refreshToken();
                } catch (err) {
                    if (err instanceof Error && !err.message.includes("web client")) {
                        throw err;
                    }
                    return res.json();
                }

                config.headers.Authorization = `Bearer ${await auth.getToken()}`
                return r();
            } else {
                return json ? res.json() : res.text()
            }
        };
        return r();
    }
}

const instance = RequestManager.getInstance()
export default instance
