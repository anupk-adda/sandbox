import type { RunnerProfileContext } from './persona-agent.js';
export interface UserProfileRecord {
    user_id: string;
    profile_json: string;
    history_summary: string | null;
    updated_at: string;
}
declare class UserProfileManager {
    private initialized;
    private ensureSchema;
    private getUserProfile;
    updateFromConversation(userId: string, conversationId: string, summaryText?: string, personaContext?: RunnerProfileContext): void;
    getUserProfileContext(userId: string): {
        history_summary?: string;
        profile?: any;
    } | undefined;
}
export declare const userProfileManager: UserProfileManager;
export {};
//# sourceMappingURL=user-profile-manager.d.ts.map