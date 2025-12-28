import type { RequestInit, HeadersInit } from 'node-fetch';
interface RequestConfig extends RequestInit {
    headers: HeadersInit & {
        Authorization?: string;
        'client-id'?: string;
    };
}
declare class RequestManager {
    private static _instance;
    private _fetch;
    private constructor();
    static getInstance(): RequestManager;
    /**
     *
     * @param {string} url the url to fetch
     * @param {object} config fetch config object
     * @param {boolean} json whether or not to parse response as JSON
     *                       if false, parse as text
     */
    request(url: string, config: RequestConfig, json?: boolean): Promise<unknown>;
}
declare const instance: RequestManager;
export default instance;
