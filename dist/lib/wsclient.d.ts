declare class WebSocketClient {
    private static _instance;
    private _connections;
    private _wsURL;
    constructor(wsURL?: string);
    /**
     * Get the ID of a free WebSocket connection
     *
     * @returns a Promise resolving to the ID of a free WebSocket connection
     */
    getFreeConnection(): Promise<string>;
    /**
     * Remove a subscription from our connections
     *
     * @param {string} id the id of the subscription to remove
     */
    removeSubscription(id: string): void;
    /**
     * Add a subscription to a connection
     *
     * @param {string} connectionID the connection id
     * @param {Subscription} subscription the subscription data
     */
    addSubscription(connectionID: string, { id, type, condition }: {
        id: string;
        type: string;
        condition: Record<string, unknown>;
    }): void;
    /**
     * Get the subscription ID for a type and condition
     *
     * @param {string} type the subscription type
     * @param {Condition} condition the condition
     */
    findSubscriptionID(type: string, condition: Record<string, unknown>): string | undefined;
    private _addConnection;
}
export default WebSocketClient;
