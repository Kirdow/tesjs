import type { AuthConfig } from './types';
declare class AuthManager {
    private static _instance;
    private _isWebClient;
    private _clientID;
    private _clientSecret?;
    private _validationInterval?;
    private _customRefresh?;
    private _refreshToken?;
    private _authToken?;
    constructor(config: AuthConfig);
    static getInstance(): AuthManager;
    /**
     * Gets the current authentication token.  This will wait until the
     * auth token exists before returning.  The auth token will be undefined
     * in the cases of app startup (until initial fetch/refresh) and token
     * refresh.  If getting the token takes longer than 1000 seconds,
     * something catastrophic is up and it will reject.
     *
     * @returns a promise that resolves the current token
     */
    getToken(): Promise<string>;
    /**
     * Refreshes the authentication token
     */
    refreshToken(): Promise<void>;
    private _validateToken;
    private _resetValidationInterval;
}
export default AuthManager;
