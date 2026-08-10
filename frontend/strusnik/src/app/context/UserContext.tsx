"use client";

import React, { createContext, useCallback, useEffect, useState } from "react";
import { User } from "../types/user";
import {
    createGuestIdentity,
    getOrCreateGuestIdentity,
    removeGuestIdentity,
    saveGuestIdentity,
} from "../utils/guest";

interface UserContextType {
    userInfo: User | null;
    setUserInfo: React.Dispatch<React.SetStateAction<User | null>>;
    isLoading: boolean;
    updateGuestName: (nickname: string) => void;
    updateAvatarUrl: (avatarUrl: string | null) => void;
    resetGuest: () => void;
}

export const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
    const [userInfo, setUserInfo] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const fetchData = async () => {
            try {
                const response = await fetch("/api/auth/parse", { method: "GET" });
                if (!cancelled && response.ok) {
                    const data = await response.json();
                    setUserInfo({
                        userId: data.user_id,
                        nickname: data.login,
                        avatarUrl: data.avatar_url ?? null,
                        isGuest: false,
                        hasPassword: data.has_password !== false,
                        hasGoogle: data.has_google === true,
                    });
                    setIsLoading(false);
                    return;
                }
            } catch {
                // An unavailable auth endpoint should not block guest play.
            }

            if (!cancelled) {
                const guest = getOrCreateGuestIdentity();
                setUserInfo({ userId: guest.id, nickname: guest.name, isGuest: true });
            }
            setIsLoading(false);
        };

        fetchData();
        return () => {
            cancelled = true;
        };
    }, []);

    const updateGuestName = useCallback((nickname: string) => {
        setUserInfo((current) => {
            if (!current?.isGuest) return current;
            const next = { ...current, nickname: nickname.trim() };
            saveGuestIdentity({ id: String(next.userId), name: next.nickname });
            return next;
        });
    }, []);

    const updateAvatarUrl = useCallback((avatarUrl: string | null) => {
        setUserInfo((current) => current ? { ...current, avatarUrl } : current);
    }, []);

    const resetGuest = useCallback(() => {
        removeGuestIdentity();
        const guest = createGuestIdentity();
        saveGuestIdentity(guest);
        setUserInfo({ userId: guest.id, nickname: guest.name, isGuest: true });
    }, []);

    return (
        <UserContext.Provider value={{ userInfo, setUserInfo, isLoading, updateGuestName, updateAvatarUrl, resetGuest }}>
            {children}
        </UserContext.Provider>
    );
};
