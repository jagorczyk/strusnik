export interface User {
    userId: number | string;
    nickname: string;
    isGuest?: boolean;
    avatarUrl?: string | null;
    hasPassword?: boolean;
    hasGoogle?: boolean;
}