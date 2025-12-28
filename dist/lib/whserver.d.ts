import type { Express } from 'express';
interface WebhookConfig {
    ignoreDuplicateMessages: boolean;
    ignoreOldMessages: boolean;
}
export default function createWebhookServer(server?: Express, secret?: string, config?: Partial<WebhookConfig>): Express;
export {};
