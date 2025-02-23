// Copyright (c) 2022 Mitchell Adair
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import type { AuthConfig } from './types'
import Logger from './logger'
import fetch from 'node-fetch'

const AUTH_API_URL = "https://id.twitch.tv/oauth2"

class AuthManager {
    private static _instance: AuthManager
    private _isWebClient: boolean = typeof(window) !== 'undefined'
    private _clientID: string = ''
    private _clientSecret?: string
    private _validationInterval?: NodeJS.Timeout
    private _customRefresh?: () => Promise<string>
    private _refreshToken?: string 
    private _authToken?: string

    constructor(config: AuthConfig) {
        if (!config.onAuthFailure) {
            if (!this._isWebClient && (!config.clientID || !config.clientSecret)) {
                throw new Error("AuthManager config must contain client ID and secret if onAuthFailure not defined")
            }
        }

        if (AuthManager._instance) {
            return AuthManager._instance
        }
        AuthManager._instance = this

        this._clientID = config.clientID
        this._clientSecret = config.clientSecret
        this._customRefresh = config.onAuthFailure
        this._refreshToken = config.refreshToken

        if (config.initialToken) {
            this._authToken = config.initialToken
            this._resetValidationInterval()
        } else {
            this.refreshToken()
        }
    }

    static getInstance(): AuthManager {
        return AuthManager._instance
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
    getToken(): Promise<string> {
        return new Promise((resolve, reject) => {
            const start = new Date()
            const retry = () => {
                if (this._authToken) {
                    resolve(this._authToken)
                } else if (new Date().getTime() - start.getTime() > 1000000) {
                    const message = "Timed out trying to get token"
                    Logger.error(`${message}.  Something catastrophic has happened!`)
                    reject(message)
                } else {
                    setTimeout(retry)
                }
            }
            retry()
        })
    }

    /**
     * Refreshes the authentication token
     */
    async refreshToken(): Promise<void> {
        Logger.debug("Getting new app access token")
        try {
            this._authToken = undefined; // set current token undefined to prevent API calls from using stale token
            // if we have a custom refresh function passed through onAuthenticationFailure, use that
            if (this._isWebClient) {
                throw new Error('cannot refresh access token on web client')
            } else if (this._customRefresh) {
                this._authToken = await this._customRefresh()
            } else {
                let refreshSnippet = ''
                let grantType = 'client_credentials'

                if (this._refreshToken) {
                    grantType = 'refresh_token'
                    refreshSnippet = `&refresh_token=${this._refreshToken}`
                }

                Logger.debug("Requesting token")

                const res = await fetch(
                    `${AUTH_API_URL}/token?client_id=${this._clientID}&client_secret=${this._clientSecret}&grant_type=${grantType}${refreshSnippet}`,
                    { method: "POST" }
                )

                Logger.debug("Got token")

                if (res.ok) {
                    Logger.debug("Getting token json")
                    const { access_token, refresh_token } = await res.json() as { access_token: string, refresh_token: string }
                    Logger.debug("Got token json. Has auth token: " + (!!access_token))
                    this._authToken = access_token
                    this._refreshToken = refresh_token
                    this._resetValidationInterval()
                } else {
                    Logger.debug("Failed to get access token")
                    const { message } = await res.json() as { message: string }
                    throw new Error(message)
                }
            }
        } catch (err) {
            if (err instanceof Error) {
                Logger.error(`Error refreshing app access token: ${err.message}`)
            } else {
                Logger.error(`Error refreshing app access token: ${err}`)
            }
            throw err
        }
    }

    private async _validateToken(): Promise<void> {
        Logger.debug("Validating app access token")
        const headers = {
            "client-id": this._clientID,
            Authorization: `Bearer ${this._authToken}`,
        }
        const res = await fetch(`${AUTH_API_URL}/validate`, { headers })
        if (res.status === 401) {
            Logger.debug("Access token not valid, refreshing...")
            await this.refreshToken()
        }
    }

    private _resetValidationInterval(): void {
        clearInterval(this._validationInterval)
        this._validationInterval = setInterval(this._validateToken.bind(this), 3600000)
    }
}

export default AuthManager