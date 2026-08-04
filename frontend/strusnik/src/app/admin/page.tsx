'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Activity,
    Ban as BanIcon,
    Bell,
    Check,
    ChevronLeft,
    ChevronRight,
    CircleAlert,
    Download,
    Eye,
    FileText,
    LayoutDashboard,
    LoaderCircle,
    LogOut,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    Shield,
    ShieldCheck,
    Sparkles,
    UserRound,
    Users,
    X,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import { useNotification } from '@/app/context/NotificationsContext';
import { useLang } from '@/app/lang';
import { t } from '@/app/i18n';
import ReturnArrow from '@/app/components/lobby/returnArrow';

interface User {
    id: number;
    name: string;
    is_admin: boolean;
    is_banned: boolean;
    created_at: string;
    last_login: string | null;
    avatar_url?: string | null;
}

interface Ban {
    id: number;
    user_id: number;
    user_name: string;
    banned_by_id: number;
    banned_by_name: string;
    reason: string;
    banned_at: string;
    expires_at: string | null;
    is_active: boolean;
    unbanned_at: string | null;
    unbanned_by_name: string | null;
}

interface GameStat {
    username: string;
    game_name?: string;
    wins: number;
    losses: number;
    draws: number;
}

interface GuestBan {
    id: number;
    guest_token: string;
    guest_name: string;
    banned_by_id: number;
    banned_by_name: string;
    reason: string;
    banned_at: string;
    expires_at: string | null;
    is_active: boolean;
    unbanned_at: string | null;
    unbanned_by_name: string | null;
}

interface UserDetails {
    user: User;
    ban_history: Ban[];
    stats: GameStat[];
}

interface AdminLog {
    id: number;
    admin_id: number;
    admin_name: string;
    action: string;
    target_user_id: number | null;
    target_user_name: string | null;
    details: string;
    ip_address: string;
    created_at: string;
}

interface Stats {
    total_users: number;
    banned_users: number;
    active_bans: number;
    admin_users: number;
    online_users: number;
    recent_bans_24h: number;
    recent_actions_24h: number;
    new_users_24h: number;
}

interface OnlineUser {
    user_id: number | null;
    guest_token?: string | null;
    username: string;
    is_guest: boolean;
    room_id: string | null;
    status: string;
}

type ChangelogCategory = 'new' | 'improved' | 'fixed';

type ChangelogCopy = {
    pl: string;
    en: string;
};

interface AdminChangelogEntry {
    id: number;
    date: string;
    title: ChangelogCopy;
    summary: ChangelogCopy;
    groups: Array<{ category: ChangelogCategory; items: ChangelogCopy[] }>;
    created_at: string;
    created_by: string | null;
}

type ChangelogDraft = {
    date: string;
    titlePl: string;
    titleEn: string;
    summaryPl: string;
    summaryEn: string;
    category: ChangelogCategory;
    itemPl: string;
    itemEn: string;
};

type TabType = 'overview' | 'users' | 'bans' | 'logs' | 'changelog';
type UserFilter = 'all' | 'active' | 'banned' | 'admins';

type ConfirmAction = {
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
};

const TAB_ITEMS: Array<{ id: TabType; label: string; icon: LucideIcon }> = [
    { id: 'overview', label: 'Przeglad', icon: LayoutDashboard },
    { id: 'users', label: 'Uzytkownicy', icon: Users },
    { id: 'bans', label: 'Blokady', icon: BanIcon },
    { id: 'logs', label: 'Logi akcji', icon: FileText },
    { id: 'changelog', label: 'Wpisy zmian', icon: Sparkles },
];

const USER_FILTERS: Array<{ value: UserFilter; label: string }> = [
    { value: 'all', label: 'Wszyscy' },
    { value: 'active', label: 'Aktywni' },
    { value: 'banned', label: 'Zablokowani' },
    { value: 'admins', label: 'Administratorzy' },
];

const LOG_ACTIONS = [
    { value: '', label: 'Wszystkie akcje' },
    { value: 'ban', label: 'Blokady' },
    { value: 'unban', label: 'Odblokowania' },
    { value: 'kick', label: 'Wyrzucenia' },
    { value: 'make_admin', label: 'Nadania admina' },
    { value: 'revoke_admin', label: 'Odebrania admina' },
    { value: 'reset_stats', label: 'Reset statystyk' },
    { value: 'notify', label: 'Komunikaty' },
    { value: 'guest_ban', label: 'Blokady gosci' },
    { value: 'guest_unban', label: 'Odblokowania gosci' },
    { value: 'guest_kick', label: 'Wyrzucenia gosci' },
    { value: 'changelog_create', label: 'Wpisy zmian' },
];

const CHANGELOG_CATEGORY_LABELS: Record<ChangelogCategory, string> = {
    new: 'Nowe',
    improved: 'Ulepszenia',
    fixed: 'Poprawki',
};

function createChangelogDraft(): ChangelogDraft {
    return {
        date: new Date().toISOString().slice(0, 10),
        titlePl: '',
        titleEn: '',
        summaryPl: '',
        summaryEn: '',
        category: 'new',
        itemPl: '',
        itemEn: '',
    };
}

export default function AdminPanel() {
    const router = useRouter();
    const { lang } = useLang();
    const { notify } = useNotification();

    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [currentAdminId, setCurrentAdminId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('overview');

    const [users, setUsers] = useState<User[]>([]);
    const [bans, setBans] = useState<Ban[]>([]);
    const [guestBans, setGuestBans] = useState<GuestBan[]>([]);
    const [logs, setLogs] = useState<AdminLog[]>([]);
    const [changelogEntries, setChangelogEntries] = useState<AdminChangelogEntry[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);

    const [usersPage, setUsersPage] = useState(1);
    const [bansPage, setBansPage] = useState(1);
    const [logsPage, setLogsPage] = useState(1);
    const [totalUsersPages, setTotalUsersPages] = useState(1);
    const [totalBansPages, setTotalBansPages] = useState(1);
    const [guestBansPage, setGuestBansPage] = useState(1);
    const [totalGuestBanPages, setTotalGuestBanPages] = useState(1);
    const [totalLogsPages, setTotalLogsPages] = useState(1);

    const [searchDraft, setSearchDraft] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [userFilter, setUserFilter] = useState<UserFilter>('all');
    const [banSearch, setBanSearch] = useState('');
    const [activeBansOnly, setActiveBansOnly] = useState(true);
    const [logAction, setLogAction] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [actionPending, setActionPending] = useState<string | null>(null);

    const [banModalOpen, setBanModalOpen] = useState(false);
    const [guestBanModalOpen, setGuestBanModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedGuest, setSelectedGuest] = useState<OnlineUser | null>(null);
    const [banReason, setBanReason] = useState('');
    const [banDuration, setBanDuration] = useState('permanent');

    const [details, setDetails] = useState<UserDetails | null>(null);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [messageModalOpen, setMessageModalOpen] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [messageTarget, setMessageTarget] = useState('all');
    const [changelogModalOpen, setChangelogModalOpen] = useState(false);
    const [changelogDraft, setChangelogDraft] = useState<ChangelogDraft>(() => createChangelogDraft());
    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
    const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
    const detailsRequestRef = useRef(0);

    const apiRequest = useCallback(async <T,>(path: string, options: RequestInit = {}) => {
        const headers = new Headers(options.headers);
        if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
        const response = await fetch(path, { ...options, headers, credentials: 'include' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(typeof data?.error === 'string' ? data.error : 'Nie udalo sie wykonac operacji.');
        }
        return data as T;
    }, []);

    const checkAdmin = useCallback(async () => {
        try {
            const data = await apiRequest<{ is_admin: boolean; user_id?: number }>('/api/admin/check');
            setIsAdmin(Boolean(data.is_admin));
            setCurrentAdminId(data.user_id ?? null);
            if (!data.is_admin) router.push('/');
        } catch {
            setIsAdmin(false);
            router.push('/');
        }
    }, [apiRequest, router]);

    const fetchStats = useCallback(async () => {
        const data = await apiRequest<Stats>('/api/admin/stats');
        setStats(data);
    }, [apiRequest]);

    const fetchOnlineUsers = useCallback(async () => {
        const data = await apiRequest<{ online: OnlineUser[] }>('/api/admin/online');
        setOnlineUsers(data.online);
    }, [apiRequest]);

    const fetchUsers = useCallback(async () => {
        const params = new URLSearchParams({
            page: String(usersPage),
            per_page: '15',
            status: userFilter,
        });
        if (searchQuery) params.set('search', searchQuery);
        const data = await apiRequest<{ users: User[]; pages: number }>(`/api/admin/users?${params}`);
        setUsers(data.users);
        setTotalUsersPages(data.pages || 1);
    }, [apiRequest, searchQuery, userFilter, usersPage]);

    const fetchBans = useCallback(async () => {
        const params = new URLSearchParams({
            page: String(bansPage),
            per_page: '15',
            active_only: String(activeBansOnly),
        });
        if (banSearch.trim()) params.set('search', banSearch.trim());
        const data = await apiRequest<{ bans: Ban[]; pages: number }>(`/api/admin/bans?${params}`);
        setBans(data.bans);
        setTotalBansPages(data.pages || 1);
    }, [activeBansOnly, apiRequest, banSearch, bansPage]);

    const fetchGuestBans = useCallback(async () => {
        const params = new URLSearchParams({
            page: String(guestBansPage),
            per_page: '15',
            active_only: String(activeBansOnly),
        });
        if (banSearch.trim()) params.set('search', banSearch.trim());
        const data = await apiRequest<{ bans: GuestBan[]; pages: number }>(`/api/admin/guest-bans?${params}`);
        setGuestBans(data.bans);
        setTotalGuestBanPages(data.pages || 1);
    }, [activeBansOnly, apiRequest, banSearch, guestBansPage]);

    const fetchLogs = useCallback(async () => {
        const params = new URLSearchParams({ page: String(logsPage), per_page: '20' });
        if (logAction) params.set('action', logAction);
        const data = await apiRequest<{ logs: AdminLog[]; pages: number }>(`/api/admin/logs?${params}`);
        setLogs(data.logs);
        setTotalLogsPages(data.pages || 1);
    }, [apiRequest, logAction, logsPage]);

    const fetchChangelog = useCallback(async () => {
        const data = await apiRequest<{ entries: AdminChangelogEntry[] }>('/api/admin/changelog');
        setChangelogEntries(data.entries);
    }, [apiRequest]);

    const refreshCurrentTab = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await Promise.all([fetchStats(), fetchOnlineUsers()]);
            if (activeTab === 'users') await fetchUsers();
            if (activeTab === 'bans') await Promise.all([fetchBans(), fetchGuestBans()]);
            if (activeTab === 'logs') await fetchLogs();
            if (activeTab === 'changelog') await fetchChangelog();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Nie udalo sie odswiezyc danych.');
        } finally {
            setLoading(false);
        }
    }, [activeTab, fetchBans, fetchChangelog, fetchGuestBans, fetchLogs, fetchOnlineUsers, fetchStats, fetchUsers]);

    useEffect(() => {
        void checkAdmin();
    }, [checkAdmin]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setSearchQuery(searchDraft.trim());
            setUsersPage(1);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [searchDraft]);

    useEffect(() => {
        if (!isAdmin) return;
        void refreshCurrentTab();
    }, [isAdmin, refreshCurrentTab]);

    useEffect(() => {
        if (!details && !banModalOpen && !guestBanModalOpen && !messageModalOpen && !confirmAction) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            if (confirmAction) setConfirmAction(null);
            else if (details) closeDetails();
            else if (banModalOpen) closeBanModal();
            else if (guestBanModalOpen) closeGuestBanModal();
            else {
                setMessageModalOpen(false);
                setMessageText('');
                setMessageTarget('all');
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    });

    useEffect(() => {
        if (!details && !banModalOpen && !guestBanModalOpen && !messageModalOpen && !confirmAction) {
            lastTriggerRef.current?.focus();
            lastTriggerRef.current = null;
        }
    }, [banModalOpen, confirmAction, details, guestBanModalOpen, messageModalOpen]);

    const closeDetails = () => {
        detailsRequestRef.current += 1;
        setDetails(null);
    };
    const closeBanModal = () => {
        setBanModalOpen(false);
        setSelectedUser(null);
        setBanReason('');
        setBanDuration('permanent');
    };

    const closeGuestBanModal = () => {
        setGuestBanModalOpen(false);
        setSelectedGuest(null);
        setBanReason('');
        setBanDuration('permanent');
    };

    const openDetails = async (user: User, trigger?: HTMLButtonElement) => {
        const requestId = detailsRequestRef.current + 1;
        detailsRequestRef.current = requestId;
        lastTriggerRef.current = trigger ?? null;
        setDetails({ user, ban_history: [], stats: [] });
        setDetailsLoading(true);
        setError(null);
        try {
            const data = await apiRequest<UserDetails>(`/api/admin/users/${user.id}`);
            if (detailsRequestRef.current === requestId) setDetails(data);
        } catch (requestError) {
            if (detailsRequestRef.current !== requestId) return;
            setDetails(null);
            setError(requestError instanceof Error ? requestError.message : 'Nie udalo sie pobrac danych uzytkownika.');
        } finally {
            if (detailsRequestRef.current === requestId) setDetailsLoading(false);
        }
    };

    const openBanModal = (user: User, trigger?: HTMLButtonElement) => {
        lastTriggerRef.current = trigger ?? null;
        setSelectedUser(user);
        setBanModalOpen(true);
        setError(null);
    };

    const openGuestBanModal = (guest: OnlineUser, trigger?: HTMLButtonElement) => {
        if (!guest.guest_token) return;
        lastTriggerRef.current = trigger ?? null;
        setSelectedGuest(guest);
        setBanReason('');
        setBanDuration('24');
        setGuestBanModalOpen(true);
        setError(null);
    };

    const refreshAfterAction = async () => {
        await refreshCurrentTab();
        if (details) {
            const data = await apiRequest<UserDetails>(`/api/admin/users/${details.user.id}`);
            setDetails(data);
        }
    };

    const handleBanUser = async () => {
        if (!selectedUser) return;
        if (!banReason.trim()) {
            setError('Podaj powod blokady.');
            return;
        }
        setActionPending(`ban-${selectedUser.id}`);
        setError(null);
        try {
            const duration = banDuration === 'permanent' ? null : Number(banDuration);
            const data = await apiRequest<{ message: string }>('/api/admin/ban', {
                method: 'POST',
                body: JSON.stringify({ user_id: selectedUser.id, reason: banReason.trim(), duration_hours: duration }),
            });
            closeBanModal();
            notify(data.message, 'success');
            await refreshAfterAction();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Nie udalo sie zablokowac uzytkownika.');
        } finally {
            setActionPending(null);
        }
    };

    const handleBanGuest = async () => {
        if (!selectedGuest?.guest_token) return;
        if (!banReason.trim()) {
            setError('Podaj powod blokady.');
            return;
        }
        setActionPending(`guest-ban-${selectedGuest.guest_token}`);
        setError(null);
        try {
            const duration = banDuration === 'permanent' ? null : Number(banDuration);
            const data = await apiRequest<{ message: string }>('/api/admin/guest-ban', {
                method: 'POST',
                body: JSON.stringify({
                    guest_token: selectedGuest.guest_token,
                    reason: banReason.trim(),
                    duration_hours: duration,
                }),
            });
            closeGuestBanModal();
            notify(data.message, 'success');
            await refreshAfterAction();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Nie udalo sie zablokowac goscia.');
        } finally {
            setActionPending(null);
        }
    };

    const handleUnbanUser = async (userId: number) => {
        setActionPending(`unban-${userId}`);
        setError(null);
        try {
            const data = await apiRequest<{ message: string }>('/api/admin/unban', {
                method: 'POST',
                body: JSON.stringify({ user_id: userId }),
            });
            notify(data.message, 'success');
            await refreshAfterAction();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Nie udalo sie odblokowac uzytkownika.');
        } finally {
            setActionPending(null);
        }
    };

    const confirmKickUser = (user: User) => {
        setConfirmAction({
            title: `Wyrzucic ${user.name}?`,
            message: 'Uzytkownik zostanie rozlaczony z aktywnej rozgrywki. Jego konto pozostanie bez zmian.',
            confirmLabel: 'Wyrzuc uzytkownika',
            onConfirm: async () => {
                setActionPending(`kick-${user.id}`);
                try {
                    const data = await apiRequest<{ message: string }>('/api/admin/kick', {
                        method: 'POST',
                        body: JSON.stringify({ user_id: user.id, reason: 'Wyrzucono przez administratora' }),
                    });
                    notify(data.message, 'success');
                    setConfirmAction(null);
                } catch (requestError) {
                    setError(requestError instanceof Error ? requestError.message : 'Nie udalo sie wyrzucic uzytkownika.');
                } finally {
                    setActionPending(null);
                }
            },
        });
    };

    const confirmKickGuest = (guest: OnlineUser) => {
        if (!guest.guest_token) return;
        setConfirmAction({
            title: `Wyrzucic goscia ${guest.username}?`,
            message: 'Gosc zostanie rozlaczony z aktywnej sesji. Jego identyfikator pozostanie bez blokady.',
            confirmLabel: 'Wyrzuc goscia',
            onConfirm: async () => {
                setActionPending(`guest-kick-${guest.guest_token}`);
                try {
                    const data = await apiRequest<{ message: string }>('/api/admin/guest-kick', {
                        method: 'POST',
                        body: JSON.stringify({ guest_token: guest.guest_token, reason: 'Wyrzucono przez administratora' }),
                    });
                    notify(data.message, 'success');
                    setConfirmAction(null);
                    await refreshCurrentTab();
                } catch (requestError) {
                    setError(requestError instanceof Error ? requestError.message : 'Nie udalo sie wyrzucic goscia.');
                } finally {
                    setActionPending(null);
                }
            },
        });
    };

    const handleUnbanGuest = async (guestBanId: number) => {
        setActionPending(`guest-unban-${guestBanId}`);
        setError(null);
        try {
            const data = await apiRequest<{ message: string }>('/api/admin/guest-unban', {
                method: 'POST',
                body: JSON.stringify({ guest_ban_id: guestBanId }),
            });
            notify(data.message, 'success');
            await refreshCurrentTab();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Nie udalo sie usunac blokady goscia.');
        } finally {
            setActionPending(null);
        }
    };

    const handleToggleAdmin = async (user: User) => {
        if (user.is_admin && user.id === currentAdminId) {
            setError('Nie mozna odebrac sobie uprawnien administratora.');
            return;
        }
        const endpoint = user.is_admin ? '/api/admin/revoke-admin' : '/api/admin/make-admin';
        setActionPending(`admin-${user.id}`);
        setError(null);
        try {
            const data = await apiRequest<{ message: string }>(endpoint, {
                method: 'POST',
                body: JSON.stringify({ user_id: user.id }),
            });
            notify(data.message, 'success');
            await refreshAfterAction();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Nie udalo sie zmienic uprawnien.');
        } finally {
            setActionPending(null);
        }
    };

    const confirmResetStats = (user: User) => {
        setConfirmAction({
            title: `Wyzerowac statystyki ${user.name}?`,
            message: 'Ta operacja usunie wszystkie zwyciestwa, porazki i remisy tego uzytkownika. Nie mozna jej cofnac.',
            confirmLabel: 'Wyzeruj statystyki',
            onConfirm: async () => {
                setActionPending(`reset-${user.id}`);
                try {
                    const data = await apiRequest<{ message: string }>('/api/admin/reset-stats', {
                        method: 'POST',
                        body: JSON.stringify({ user_id: user.id }),
                    });
                    notify(data.message, 'success');
                    const refreshed = await apiRequest<UserDetails>(`/api/admin/users/${user.id}`);
                    setDetails(refreshed);
                    setConfirmAction(null);
                } catch (requestError) {
                    setError(requestError instanceof Error ? requestError.message : 'Nie udalo sie wyzerowac statystyk.');
                } finally {
                    setActionPending(null);
                }
            },
        });
    };

    const openChangelogModal = () => {
        setChangelogDraft(createChangelogDraft());
        setChangelogModalOpen(true);
        setError(null);
    };

    const updateChangelogDraft = <K extends keyof ChangelogDraft>(field: K, value: ChangelogDraft[K]) => {
        setChangelogDraft((current) => ({ ...current, [field]: value }));
    };

    const handleCreateChangelog = async () => {
        const draft = changelogDraft;
        if (!draft.titlePl.trim() || !draft.titleEn.trim() || !draft.summaryPl.trim() || !draft.summaryEn.trim() || !draft.itemPl.trim() || !draft.itemEn.trim()) {
            setError('Uzupelnij wszystkie wersje jezykowe wpisu.');
            return;
        }

        setActionPending('changelog-create');
        setError(null);
        try {
            const data = await apiRequest<{ message: string }>('/api/admin/changelog', {
                method: 'POST',
                body: JSON.stringify({
                    date: draft.date,
                    title: { pl: draft.titlePl.trim(), en: draft.titleEn.trim() },
                    summary: { pl: draft.summaryPl.trim(), en: draft.summaryEn.trim() },
                    category: draft.category,
                    item: { pl: draft.itemPl.trim(), en: draft.itemEn.trim() },
                }),
            });
            setChangelogModalOpen(false);
            notify(data.message, 'success');
            await Promise.all([fetchChangelog(), fetchStats()]);
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Nie udalo sie dodac wpisu zmian.');
        } finally {
            setActionPending(null);
        }
    };

    const handleSendMessage = async () => {
        if (!messageText.trim()) {
            setError('Wpisz tresc komunikatu.');
            return;
        }
        setActionPending('notify');
        setError(null);
        try {
            const data = await apiRequest<{ message: string }>('/api/admin/notify', {
                method: 'POST',
                body: JSON.stringify({
                    message: messageText.trim(),
                    user_id: messageTarget === 'all' ? null : Number(messageTarget),
                }),
            });
            setMessageModalOpen(false);
            setMessageText('');
            setMessageTarget('all');
            notify(data.message, 'success');
            await fetchStats();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Nie udalo sie wyslac komunikatu.');
        } finally {
            setActionPending(null);
        }
    };

    const exportLogs = () => {
        const header = ['Data', 'Administrator', 'Akcja', 'Cel', 'Szczegoly', 'IP'];
        const rows = logs.map((log) => [
            formatDate(log.created_at),
            log.admin_name,
            actionLabel(log.action),
            log.target_user_name || 'Brak',
            log.details || 'Brak',
            log.ip_address || 'Brak',
        ]);
        const csv = [header, ...rows]
            .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
            .join('\n');
        const link = document.createElement('a');
        link.href = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
        link.download = `strusnik-logi-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        notify('Wyeksportowano logi z biezacej strony.', 'success');
    };

    if (isAdmin === null) {
        return (
            <main className="admin-shell admin-shell--loading" aria-busy="true">
                <LoaderCircle className="animate-spin" size={28} aria-hidden="true" />
                <p>Sprawdzanie uprawnien...</p>
            </main>
        );
    }

    if (!isAdmin) return null;

    return (
        <main id="main-content" className="admin-shell">
            <div className="admin-backdrop" aria-hidden="true" />
            <div className="admin-container">
                <header className="admin-header">
                    <ReturnArrow href="/" text={t(lang, 'arrow')} />
                    <div className="admin-header__copy">
                        <p className="admin-kicker"><ShieldCheck size={16} aria-hidden="true" /> Centrum kontroli</p>
                        <h1>Panel administratora</h1>
                        <p>Zarzadzaj kontami, blokadami i bezpieczenstwem rozgrywek w jednym miejscu.</p>
                    </div>
                </header>

                {error && (
                    <div className="admin-alert admin-alert--error" role="alert">
                        <CircleAlert size={18} aria-hidden="true" />
                        <p>{error}</p>
                        <button type="button" onClick={() => setError(null)} aria-label="Zamknij komunikat bledu"><X size={16} aria-hidden="true" /></button>
                    </div>
                )}

                <section className="admin-stats-section" aria-labelledby="admin-stats-title">
                    <div className="admin-section-heading admin-stats-heading">
                        <div>
                            <p className="admin-eyebrow">Dane panelu</p>
                            <h2 id="admin-stats-title">Najwazniejsze statystyki</h2>
                        </div>
                        <RefreshAction loading={loading} onClick={() => void refreshCurrentTab()} />
                    </div>
                    <div className="admin-stats">
                        <StatCard icon={Users} label="Wszyscy gracze" value={stats?.total_users ?? '—'} tone="neutral" />
                        <StatCard icon={Activity} label="Online teraz" value={stats?.online_users ?? '—'} tone="green" />
                        <StatCard icon={BanIcon} label="Aktywne blokady" value={stats?.active_bans ?? '—'} tone="red" />
                        <StatCard icon={Shield} label="Administratorzy" value={stats?.admin_users ?? '—'} tone="amber" />
                        <StatCard icon={Zap} label="Nowi przez 24 h" value={stats?.new_users_24h ?? '—'} tone="blue" />
                        <StatCard icon={FileText} label="Akcje przez 24 h" value={stats?.recent_actions_24h ?? '—'} tone="purple" />
                    </div>
                </section>

                <nav className="admin-tabs" aria-label="Sekcje panelu" role="tablist">
                    {TAB_ITEMS.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={activeTab === id}
                            id={`admin-tab-button-${id}`}
                            aria-controls={`admin-panel-${id}`}
                            className={`admin-tab ${activeTab === id ? 'is-active' : ''}`}
                            onClick={() => setActiveTab(id)}
                        >
                            <Icon size={17} aria-hidden="true" />
                            {label}
                        </button>
                    ))}
                </nav>

                <div className="admin-tab-content">
                    {activeTab === 'overview' && (
                        <section id="admin-panel-overview" role="tabpanel" aria-labelledby="admin-tab-button-overview" tabIndex={0}>
                            <div className="admin-overview-grid">
                                <section className="admin-card admin-quick-actions" aria-labelledby="quick-actions-title">
                                    <div className="admin-section-heading">
                                        <div>
                                            <p className="admin-eyebrow">Najczestsze operacje</p>
                                            <h2 id="quick-actions-title">Szybkie akcje</h2>
                                        </div>
                                        <Zap size={20} aria-hidden="true" />
                                    </div>
                                    <div className="admin-action-grid">
                                        <QuickAction icon={Users} label="Przegladaj uzytkownikow" onClick={() => setActiveTab('users')} />
                                        <QuickAction icon={Bell} label="Wyslij komunikat" onClick={() => setMessageModalOpen(true)} />
                                        <QuickAction icon={BanIcon} label="Sprawdz blokady" onClick={() => setActiveTab('bans')} />
                                        <QuickAction icon={FileText} label="Otworz logi" onClick={() => setActiveTab('logs')} />
                                    </div>
                                </section>

                                <section className="admin-card" aria-labelledby="online-title">
                                    <div className="admin-section-heading">
                                        <div>
                                            <p className="admin-eyebrow">Aktywne sesje</p>
                                            <h2 id="online-title">Gracze online</h2>
                                        </div>
                                        <span className="admin-count">{onlineUsers.length}</span>
                                    </div>
                                    {onlineUsers.length === 0 ? (
                                        <EmptyState icon={Users} title="Nikt nie jest teraz online" description="Lista zaktualizuje sie po odswiezeniu panelu." />
                                    ) : (
                                        <ul className="admin-online-list">
                                            {onlineUsers.map((player, index) => (
                                                <li key={`${player.username}-${index}`}>
                                                    <span className="admin-avatar" aria-hidden="true">{player.username.slice(0, 1).toUpperCase()}</span>
                                                    <span className="admin-online-name"><strong>{player.username}</strong><small>{player.is_guest ? 'Gosc' : player.status}</small></span>
                                                    <span className="admin-online-dot" aria-label="Online" />
                                                    {player.is_guest && player.guest_token && (
                                                        <div className="admin-online-actions">
                                                            <ActionButton
                                                                icon={BanIcon}
                                                                label="Zablokuj"
                                                                onClick={(event) => { event.stopPropagation(); openGuestBanModal(player, event.currentTarget); }}
                                                                variant="red"
                                                                disabled={actionPending === `guest-ban-${player.guest_token}`}
                                                            />
                                                            <ActionButton
                                                                icon={LogOut}
                                                                label="Wyrzuc"
                                                                onClick={(event) => { event.stopPropagation(); confirmKickGuest(player); }}
                                                                variant="amber"
                                                                disabled={actionPending === `guest-kick-${player.guest_token}`}
                                                            />
                                                        </div>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </section>
                            </div>
                            <section className="admin-card admin-overview-note" aria-label="Informacja o panelu">
                                <div className="admin-overview-note__icon"><Shield size={20} aria-hidden="true" /></div>
                                <div><h2>Bezpieczne zarzadzanie</h2><p>Wszystkie zmiany uprawnien, blokad i komunikatow trafiaja do logow administracyjnych.</p></div>
                                <button type="button" className="admin-link-button" onClick={() => setActiveTab('logs')}>Otworz logi <ChevronRight size={16} aria-hidden="true" /></button>
                            </section>
                        </section>
                    )}

                    {activeTab === 'users' && (
                        <section id="admin-panel-users" role="tabpanel" aria-labelledby="admin-tab-button-users" tabIndex={0}>
                            <SectionHeader eyebrow="Baza kont" title="Uzytkownicy" description="Wyszukuj konta i zarzadzaj ich dostepem." />
                            <div className="admin-toolbar">
                                <label className="admin-search">
                                    <Search size={17} aria-hidden="true" />
                                    <span className="sr-only">Szukaj uzytkownika</span>
                                    <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Szukaj po nazwie" />
                                    {searchDraft && <button type="button" onClick={() => setSearchDraft('')} aria-label="Wyczysc wyszukiwanie"><X size={15} aria-hidden="true" /></button>}
                                </label>
                                <label className="admin-select-wrap"><span>Pokaz</span><select value={userFilter} onChange={(event) => { setUserFilter(event.target.value as UserFilter); setUsersPage(1); }}>{USER_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select></label>
                            </div>
                            <UserTable
                                users={users}
                                currentAdminId={currentAdminId}
                                actionPending={actionPending}
                                onDetails={(user, event) => void openDetails(user, event.currentTarget)}
                                onBan={(user, event) => openBanModal(user, event.currentTarget)}
                                onUnban={(user) => void handleUnbanUser(user.id)}
                                onKick={confirmKickUser}
                                onToggleAdmin={(user) => void handleToggleAdmin(user)}
                            />
                            <Pagination currentPage={usersPage} totalPages={totalUsersPages} onPageChange={setUsersPage} />
                        </section>
                    )}

                    {activeTab === 'bans' && (
                        <section id="admin-panel-bans" role="tabpanel" aria-labelledby="admin-tab-button-bans" tabIndex={0}>
                            <SectionHeader eyebrow="Dostep do kont" title="Historia blokad" description="Przegladaj aktywne i zakonczone blokady kont oraz gosci." />
                            <div className="admin-toolbar">
                                <label className="admin-search"><Search size={17} aria-hidden="true" /><span className="sr-only">Szukaj zablokowanego uzytkownika</span><input value={banSearch} onChange={(event) => { setBanSearch(event.target.value); setBansPage(1); setGuestBansPage(1); }} placeholder="Szukaj po nazwie" />{banSearch && <button type="button" onClick={() => { setBanSearch(''); setBansPage(1); setGuestBansPage(1); }} aria-label="Wyczysc wyszukiwanie"><X size={15} aria-hidden="true" /></button>}</label>
                                <label className="admin-checkbox"><input type="checkbox" checked={activeBansOnly} onChange={(event) => { setActiveBansOnly(event.target.checked); setBansPage(1); setGuestBansPage(1); }} /><span>Tylko aktywne</span></label>
                            </div>
                            <BanTable bans={bans} actionPending={actionPending} onUnban={(ban) => void handleUnbanUser(ban.user_id)} />
                            <Pagination currentPage={bansPage} totalPages={totalBansPages} onPageChange={setBansPage} />
                            <section className="admin-card admin-guest-bans-section" aria-labelledby="guest-bans-title">
                                <div className="admin-section-heading">
                                    <div>
                                        <p className="admin-eyebrow">Sesje bez konta</p>
                                        <h2 id="guest-bans-title">Blokady gosci</h2>
                                    </div>
                                    <span className="admin-count">{guestBans.length}</span>
                                </div>
                                <GuestBanTable bans={guestBans} actionPending={actionPending} onUnban={(ban) => void handleUnbanGuest(ban.id)} />
                                <Pagination currentPage={guestBansPage} totalPages={totalGuestBanPages} onPageChange={setGuestBansPage} />
                            </section>
                        </section>
                    )}

                    {activeTab === 'logs' && (
                        <section id="admin-panel-logs" role="tabpanel" aria-labelledby="admin-tab-button-logs" tabIndex={0}>
                            <SectionHeader eyebrow="Historia zmian" title="Logi administracyjne" description="Kazda operacja zostawia slad z data i celem." action={<button type="button" className="admin-button admin-button--secondary" onClick={exportLogs} disabled={!logs.length}><Download size={16} aria-hidden="true" />Eksportuj strone</button>} />
                            <div className="admin-toolbar"><label className="admin-select-wrap"><span>Filtruj akcje</span><select value={logAction} onChange={(event) => { setLogAction(event.target.value); setLogsPage(1); }}>{LOG_ACTIONS.map((action) => <option key={action.value} value={action.value}>{action.label}</option>)}</select></label></div>
                            <LogTable logs={logs} />
                            <Pagination currentPage={logsPage} totalPages={totalLogsPages} onPageChange={setLogsPage} />
                        </section>
                    )}

                    {activeTab === 'changelog' && (
                        <section id="admin-panel-changelog" role="tabpanel" aria-labelledby="admin-tab-button-changelog" tabIndex={0}>
                            <SectionHeader
                                eyebrow="Publiczna historia"
                                title="Wpisy zmian"
                                description="Dodawaj nowe funkcje, ulepszenia i poprawki widoczne na stronie changelogu."
                                action={<button type="button" className="admin-button admin-button--primary" onClick={openChangelogModal}><Plus size={16} aria-hidden="true" />Dodaj wpis</button>}
                            />
                            <ChangelogAdminList entries={changelogEntries} />
                        </section>
                    )}
                </div>
            </div>

            {banModalOpen && selectedUser && <BanModal user={selectedUser} reason={banReason} duration={banDuration} pending={actionPending === `ban-${selectedUser.id}`} onReasonChange={setBanReason} onDurationChange={setBanDuration} onSubmit={() => void handleBanUser()} onClose={closeBanModal} />}
            {guestBanModalOpen && selectedGuest && <GuestBanModal guest={selectedGuest} reason={banReason} duration={banDuration} pending={actionPending === `guest-ban-${selectedGuest.guest_token}`} onReasonChange={setBanReason} onDurationChange={setBanDuration} onSubmit={() => void handleBanGuest()} onClose={closeGuestBanModal} />}
            {details && <DetailsModal details={details} loading={detailsLoading} currentAdminId={currentAdminId} actionPending={actionPending} onClose={closeDetails} onResetStats={confirmResetStats} />}
            {messageModalOpen && <MessageModal onlineUsers={onlineUsers} message={messageText} target={messageTarget} pending={actionPending === 'notify'} onMessageChange={setMessageText} onTargetChange={setMessageTarget} onSubmit={() => void handleSendMessage()} onClose={() => { setMessageModalOpen(false); setMessageText(''); setMessageTarget('all'); }} />}
            {changelogModalOpen && <ChangelogModal draft={changelogDraft} pending={actionPending === 'changelog-create'} onChange={updateChangelogDraft} onSubmit={() => void handleCreateChangelog()} onClose={() => setChangelogModalOpen(false)} />}
            {confirmAction && <ConfirmDialog action={confirmAction} pending={Boolean(actionPending)} onCancel={() => setConfirmAction(null)} />}
        </main>
    );
}

function ChangelogAdminList({ entries }: { entries: AdminChangelogEntry[] }) {
    if (!entries.length) {
        return <EmptyState icon={Sparkles} title="Brak wpisow" description="Dodaj pierwszy wpis zmian, aby pokazac go na stronie changelogu." />;
    }

    return (
        <div className="admin-changelog-list">
            {entries.map((entry) => {
                const group = entry.groups[0];
                const category = group?.category || 'new';
                const item = group?.items[0];
                return (
                    <article className="admin-card admin-changelog-item" key={entry.id}>
                        <div className="admin-changelog-item__meta">
                            <span className={`admin-status admin-status--${category}`}>{CHANGELOG_CATEGORY_LABELS[category]}</span>
                            <time dateTime={entry.date}>{formatDate(entry.date)}</time>
                        </div>
                        <h3>{entry.title.pl}</h3>
                        <p>{entry.summary.pl}</p>
                        {item && <strong>{item.pl}</strong>}
                        <small>EN: {entry.title.en}</small>
                    </article>
                );
            })}
        </div>
    );
}

function ChangelogModal({ draft, pending, onChange, onSubmit, onClose }: { draft: ChangelogDraft; pending: boolean; onChange: (field: keyof ChangelogDraft, value: string) => void; onSubmit: () => void; onClose: () => void }) {
    return (
        <ModalShell title="Dodaj wpis zmian" description="Wpis pojawi sie na publicznej stronie changelogu po zapisaniu." onClose={onClose}>
            <div className="admin-form">
                <label htmlFor="changelog-date">Data publikacji</label>
                <input id="changelog-date" type="date" value={draft.date} onChange={(event) => onChange('date', event.target.value)} />

                <label htmlFor="changelog-title-pl">Tytul PL</label>
                <input id="changelog-title-pl" value={draft.titlePl} onChange={(event) => onChange('titlePl', event.target.value)} maxLength={200} autoFocus />

                <label htmlFor="changelog-title-en">Tytul EN</label>
                <input id="changelog-title-en" value={draft.titleEn} onChange={(event) => onChange('titleEn', event.target.value)} maxLength={200} />

                <label htmlFor="changelog-summary-pl">Opis PL</label>
                <textarea id="changelog-summary-pl" value={draft.summaryPl} onChange={(event) => onChange('summaryPl', event.target.value)} maxLength={2000} rows={3} />

                <label htmlFor="changelog-summary-en">Opis EN</label>
                <textarea id="changelog-summary-en" value={draft.summaryEn} onChange={(event) => onChange('summaryEn', event.target.value)} maxLength={2000} rows={3} />

                <label htmlFor="changelog-category">Kategoria</label>
                <select id="changelog-category" value={draft.category} onChange={(event) => onChange('category', event.target.value)}>
                    <option value="new">Nowe</option>
                    <option value="improved">Ulepszenia</option>
                    <option value="fixed">Poprawki</option>
                </select>

                <label htmlFor="changelog-item-pl">Opis zmiany PL</label>
                <textarea id="changelog-item-pl" value={draft.itemPl} onChange={(event) => onChange('itemPl', event.target.value)} maxLength={1000} rows={3} />

                <label htmlFor="changelog-item-en">Opis zmiany EN</label>
                <textarea id="changelog-item-en" value={draft.itemEn} onChange={(event) => onChange('itemEn', event.target.value)} maxLength={1000} rows={3} />
            </div>
            <ModalActions primaryLabel="Dodaj wpis" primaryIcon={Plus} pending={pending} onPrimary={onSubmit} onClose={onClose} />
        </ModalShell>
    );
}

function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
    return <div className="admin-section-header"><div><p className="admin-eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div>{action}</div>;
}

function RefreshAction({ loading, onClick }: { loading: boolean; onClick: () => void }) {
    return <button type="button" className="admin-button admin-button--secondary" onClick={onClick} disabled={loading} aria-label="Odswiez dane panelu"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />Odswiez</button>;
}

function StatCard({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number | string; tone: string }) {
    return <article className={`admin-stat-card admin-stat-card--${tone}`}><span className="admin-stat-icon"><Icon size={18} aria-hidden="true" /></span><div><strong className="tabular-nums">{value}</strong><span>{label}</span></div></article>;
}

function QuickAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
    return <button type="button" className="admin-quick-action" onClick={onClick}><span><Icon size={18} aria-hidden="true" /></span><strong>{label}</strong><ChevronRight size={16} aria-hidden="true" /></button>;
}

function UserTable({ users, currentAdminId, actionPending, onDetails, onBan, onUnban, onKick, onToggleAdmin }: { users: User[]; currentAdminId: number | null; actionPending: string | null; onDetails: (user: User, event: React.MouseEvent<HTMLButtonElement>) => void; onBan: (user: User, event: React.MouseEvent<HTMLButtonElement>) => void; onUnban: (user: User) => void; onKick: (user: User) => void; onToggleAdmin: (user: User) => void }) {
    if (!users.length) return <EmptyState icon={UserRound} title="Nie znaleziono uzytkownikow" description="Zmien wyszukiwanie albo filtr, aby zobaczyc inne konta." />;
    return <div className="admin-table-wrap"><table className="admin-table"><caption className="sr-only">Lista uzytkownikow</caption><thead><tr><th scope="col">Uzytkownik</th><th scope="col">Status</th><th scope="col">Utworzono</th><th scope="col">Ostatnie logowanie</th><th scope="col">Akcje</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><div className="admin-user-cell"><span className="admin-avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>ID {user.id}{user.is_admin ? ' · Administrator' : ''}</small></span></div></td><td><StatusBadge banned={user.is_banned} admin={user.is_admin} /></td><td>{formatDate(user.created_at)}</td><td>{formatDate(user.last_login)}</td><td><div className="admin-row-actions"><ActionButton icon={Eye} label="Szczegoly" onClick={(event) => onDetails(user, event)} variant="neutral" /><ActionButton icon={user.is_banned ? Check : BanIcon} label={user.is_banned ? 'Odbanuj' : 'Banuj'} onClick={(event) => user.is_banned ? onUnban(user) : onBan(user, event)} variant={user.is_banned ? 'green' : 'red'} disabled={Boolean(actionPending?.includes(`${user.is_banned ? 'unban' : 'ban'}-${user.id}`)) || (user.is_admin && !user.is_banned)} /><ActionButton icon={LogOut} label="Wyrzuc" onClick={() => onKick(user)} variant="amber" disabled={Boolean(actionPending?.includes(`kick-${user.id}`))} /><ActionButton icon={Shield} label={user.is_admin ? 'Odbierz admina' : 'Nadaj admina'} onClick={() => onToggleAdmin(user)} variant="blue" disabled={user.is_admin && user.id === currentAdminId || actionPending === `admin-${user.id}`} /></div></td></tr>)}</tbody></table></div>;
}

function BanTable({ bans, actionPending, onUnban }: { bans: Ban[]; actionPending: string | null; onUnban: (ban: Ban) => void }) {
    if (!bans.length) return <EmptyState icon={BanIcon} title="Brak blokad" description="Nie ma blokad pasujacych do wybranych filtrow." />;
    return <div className="admin-table-wrap"><table className="admin-table"><caption className="sr-only">Historia blokad uzytkownikow</caption><thead><tr><th scope="col">Uzytkownik</th><th scope="col">Powod</th><th scope="col">Blokade nalozyl</th><th scope="col">Wygasa</th><th scope="col">Status</th><th scope="col">Akcja</th></tr></thead><tbody>{bans.map((ban) => <tr key={ban.id}><td><strong>{ban.user_name}</strong><small className="admin-table-subtext">{formatDate(ban.banned_at)}</small></td><td className="admin-reason">{ban.reason || 'Nie podano powodu'}</td><td>{ban.banned_by_name}</td><td>{ban.expires_at ? formatDate(ban.expires_at) : 'Bezterminowa'}</td><td><span className={`admin-status ${ban.is_active ? 'is-danger' : 'is-muted'}`}>{ban.is_active ? 'Aktywna' : 'Zakonczona'}</span></td><td>{ban.is_active ? <ActionButton icon={Check} label="Odbanuj" onClick={() => onUnban(ban)} variant="green" disabled={actionPending === `unban-${ban.user_id}`} /> : <span className="admin-muted">Brak akcji</span>}</td></tr>)}</tbody></table></div>;
}

function GuestBanTable({ bans, actionPending, onUnban }: { bans: GuestBan[]; actionPending: string | null; onUnban: (ban: GuestBan) => void }) {
    if (!bans.length) return <EmptyState icon={BanIcon} title="Brak blokad gosci" description="Nie ma blokad gosci pasujacych do wybranych filtrow." />;
    return <div className="admin-table-wrap"><table className="admin-table"><caption className="sr-only">Historia blokad gosci</caption><thead><tr><th scope="col">Gosc</th><th scope="col">Powod</th><th scope="col">Blokade nalozyl</th><th scope="col">Wygasa</th><th scope="col">Status</th><th scope="col">Akcja</th></tr></thead><tbody>{bans.map((ban) => <tr key={ban.id}><td><strong>{ban.guest_name}</strong><small className="admin-table-subtext">Sesja {ban.guest_token.slice(-8)}</small></td><td className="admin-reason">{ban.reason || 'Nie podano powodu'}</td><td>{ban.banned_by_name}</td><td>{ban.expires_at ? formatDate(ban.expires_at) : 'Bezterminowa'}</td><td><span className={`admin-status ${ban.is_active ? 'is-danger' : 'is-muted'}`}>{ban.is_active ? 'Aktywna' : 'Zakonczona'}</span></td><td>{ban.is_active ? <ActionButton icon={Check} label="Odblokuj" onClick={() => onUnban(ban)} variant="green" disabled={actionPending === `guest-unban-${ban.id}`} /> : <span className="admin-muted">Brak akcji</span>}</td></tr>)}</tbody></table></div>;
}

function LogTable({ logs }: { logs: AdminLog[] }) {
    if (!logs.length) return <EmptyState icon={FileText} title="Brak logow" description="Nie ma jeszcze akcji pasujacych do wybranego filtra." />;
    return <div className="admin-table-wrap"><table className="admin-table"><caption className="sr-only">Logi administracyjne</caption><thead><tr><th scope="col">Data</th><th scope="col">Administrator</th><th scope="col">Akcja</th><th scope="col">Cel</th><th scope="col">Szczegoly</th><th scope="col">IP</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{formatDate(log.created_at)}</td><td>{log.admin_name}</td><td><ActionBadge action={log.action} /></td><td>{log.target_user_name || 'Brak'}</td><td className="admin-reason">{log.details || 'Brak szczegolow'}</td><td className="admin-mono">{log.ip_address || 'Brak'}</td></tr>)}</tbody></table></div>;
}

function StatusBadge({ banned, admin }: { banned: boolean; admin: boolean }) {
    if (banned) return <span className="admin-status is-danger"><span aria-hidden="true">●</span> Zablokowany</span>;
    if (admin) return <span className="admin-status is-admin"><Shield size={13} aria-hidden="true" /> Admin</span>;
    return <span className="admin-status is-success"><span aria-hidden="true">●</span> Aktywny</span>;
}

function ActionButton({ icon: Icon, label, onClick, variant, disabled = false }: { icon: LucideIcon; label: string; onClick: (event: React.MouseEvent<HTMLButtonElement>) => void; variant: string; disabled?: boolean }) {
    return <button type="button" className={`admin-action-button admin-action-button--${variant}`} onClick={onClick} disabled={disabled}><Icon size={14} aria-hidden="true" /><span>{label}</span></button>;
}

function ActionBadge({ action }: { action: string }) {
    const labels: Record<string, string> = { ban: 'Blokada', unban: 'Odblokowanie', kick: 'Wyrzucenie', make_admin: 'Nadanie admina', revoke_admin: 'Odebranie admina', reset_stats: 'Reset statystyk', notify: 'Komunikat', guest_ban: 'Blokada goscia', guest_unban: 'Odblokowanie goscia', guest_kick: 'Wyrzucenie goscia' };
    return <span className={`admin-action-badge admin-action-badge--${action}`}>{labels[action] || action}</span>;
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
    return <div className="admin-empty"><Icon size={22} aria-hidden="true" /><strong>{title}</strong><p>{description}</p></div>;
}

function Pagination({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void }) {
    if (totalPages <= 1) return null;
    return <nav className="admin-pagination" aria-label="Paginacja"><button type="button" onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} aria-label="Poprzednia strona"><ChevronLeft size={17} aria-hidden="true" /></button><span><strong>{currentPage}</strong> z {totalPages}</span><button type="button" onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} aria-label="Nastepna strona"><ChevronRight size={17} aria-hidden="true" /></button></nav>;
}

function BanModal({ user, reason, duration, pending, onReasonChange, onDurationChange, onSubmit, onClose }: { user: User; reason: string; duration: string; pending: boolean; onReasonChange: (value: string) => void; onDurationChange: (value: string) => void; onSubmit: () => void; onClose: () => void }) {
    return <ModalShell title={`Zablokuj ${user.name}`} description="Uzytkownik nie bedzie mogl sie zalogowac podczas blokady." onClose={onClose}><div className="admin-form"><label htmlFor="ban-reason">Powod blokady<span aria-hidden="true"> *</span></label><textarea id="ban-reason" value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Np. zaklocanie rozgrywki" rows={4} autoFocus aria-required="true" /><label htmlFor="ban-duration">Czas trwania</label><select id="ban-duration" value={duration} onChange={(event) => onDurationChange(event.target.value)}><option value="1">1 godzina</option><option value="6">6 godzin</option><option value="24">24 godziny</option><option value="72">3 dni</option><option value="168">7 dni</option><option value="720">30 dni</option><option value="permanent">Bezterminowo</option></select></div><ModalActions primaryLabel="Zablokuj konto" primaryIcon={BanIcon} pending={pending} onPrimary={onSubmit} onClose={onClose} /></ModalShell>;
}

function GuestBanModal({ guest, reason, duration, pending, onReasonChange, onDurationChange, onSubmit, onClose }: { guest: OnlineUser; reason: string; duration: string; pending: boolean; onReasonChange: (value: string) => void; onDurationChange: (value: string) => void; onSubmit: () => void; onClose: () => void }) {
    return <ModalShell title={`Zablokuj goscia ${guest.username}`} description="Blokada dotyczy identyfikatora tego goscia. Wyczyszczenie danych przegladarki utworzy nowy identyfikator." onClose={onClose}><div className="admin-form"><label htmlFor="guest-ban-reason">Powod blokady<span aria-hidden="true"> *</span></label><textarea id="guest-ban-reason" value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Np. zaklocanie rozgrywki" rows={4} autoFocus aria-required="true" /><label htmlFor="guest-ban-duration">Czas trwania</label><select id="guest-ban-duration" value={duration} onChange={(event) => onDurationChange(event.target.value)}><option value="1">1 godzina</option><option value="6">6 godzin</option><option value="24">24 godziny</option><option value="72">3 dni</option><option value="168">7 dni</option><option value="720">30 dni</option><option value="permanent">Bezterminowo</option></select></div><ModalActions primaryLabel="Zablokuj goscia" primaryIcon={BanIcon} pending={pending} onPrimary={onSubmit} onClose={onClose} /></ModalShell>;
}

function DetailsModal({ details, loading, currentAdminId, actionPending, onClose, onResetStats }: { details: UserDetails; loading: boolean; currentAdminId: number | null; actionPending: string | null; onClose: () => void; onResetStats: (user: User) => void }) {
    const totalWins = details.stats.reduce((sum, stat) => sum + stat.wins, 0);
    const totalLosses = details.stats.reduce((sum, stat) => sum + stat.losses, 0);
    const totalDraws = details.stats.reduce((sum, stat) => sum + stat.draws, 0);
    return <ModalShell title={details.user.name} description={`Konto utworzone ${formatDate(details.user.created_at)}`} onClose={onClose}><div className="admin-detail-status"><StatusBadge banned={details.user.is_banned} admin={details.user.is_admin} /><span>ID {details.user.id}</span><span>Ostatnie logowanie: {formatDate(details.user.last_login)}</span></div><div className="admin-detail-stats"><div><strong>{totalWins}</strong><span>Wygrane</span></div><div><strong>{totalLosses}</strong><span>Porazki</span></div><div><strong>{totalDraws}</strong><span>Remisy</span></div></div><section className="admin-detail-section" aria-labelledby="game-stats-title"><div className="admin-detail-heading"><h3 id="game-stats-title">Statystyki gier</h3><button type="button" className="admin-link-button admin-link-button--danger" onClick={() => onResetStats(details.user)} disabled={actionPending === `reset-${details.user.id}` || loading}><RotateCcw size={15} aria-hidden="true" />Wyzeruj</button></div>{loading ? <div className="admin-inline-loading"><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />Pobieranie danych...</div> : details.stats.length ? <div className="admin-stats-list">{details.stats.map((stat, index) => <div key={`${stat.game_name || stat.username}-${index}`}><strong>{stat.game_name || 'Gra'}</strong><span>{stat.wins} W · {stat.losses} P · {stat.draws} R</span></div>)}</div> : <p className="admin-muted">Brak zapisanych statystyk.</p>}</section><section className="admin-detail-section" aria-labelledby="ban-history-title"><h3 id="ban-history-title">Historia blokad</h3>{details.ban_history.length ? <ul className="admin-history-list">{details.ban_history.slice(0, 5).map((ban) => <li key={ban.id}><span className={`admin-status ${ban.is_active ? 'is-danger' : 'is-muted'}`}>{ban.is_active ? 'Aktywna' : 'Zakonczona'}</span><span>{ban.reason || 'Nie podano powodu'}</span><small>{formatDate(ban.banned_at)}</small></li>)}</ul> : <p className="admin-muted">Brak historii blokad.</p>}</section><div className="admin-modal-footer"><button type="button" className="admin-button admin-button--secondary" onClick={onClose}>Zamknij</button>{details.user.is_admin && details.user.id === currentAdminId && <span className="admin-muted">To jest Twoje konto.</span>}</div></ModalShell>;
}

function MessageModal({ onlineUsers, message, target, pending, onMessageChange, onTargetChange, onSubmit, onClose }: { onlineUsers: OnlineUser[]; message: string; target: string; pending: boolean; onMessageChange: (value: string) => void; onTargetChange: (value: string) => void; onSubmit: () => void; onClose: () => void }) {
    const registered = onlineUsers.filter((user) => user.user_id !== null);
    return <ModalShell title="Wyslij komunikat" description="Komunikat pojawi sie jako powiadomienie u wybranego odbiorcy." onClose={onClose}><div className="admin-form"><label htmlFor="message-target">Odbiorca</label><select id="message-target" value={target} onChange={(event) => onTargetChange(event.target.value)}><option value="all">Wszyscy online</option>{registered.map((user) => <option key={user.user_id} value={String(user.user_id)}>{user.username}</option>)}</select><label htmlFor="admin-message">Tresc komunikatu</label><textarea id="admin-message" value={message} onChange={(event) => onMessageChange(event.target.value)} placeholder="Wpisz krotka informacje dla graczy" rows={4} maxLength={300} autoFocus /><span className="admin-character-count">{message.length}/300</span></div><ModalActions primaryLabel="Wyslij komunikat" primaryIcon={Bell} pending={pending} onPrimary={onSubmit} onClose={onClose} /></ModalShell>;
}

function ConfirmDialog({ action, pending, onCancel }: { action: ConfirmAction; pending: boolean; onCancel: () => void }) {
    return <ModalShell title={action.title} description={action.message} onClose={onCancel}><ModalActions primaryLabel={action.confirmLabel} primaryIcon={CircleAlert} pending={pending} onPrimary={() => void action.onConfirm()} onClose={onCancel} danger /></ModalShell>;
}

function ModalShell({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
    const titleId = useId();
    const descriptionId = useId();
    const modalRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const modal = modalRef.current;
        if (!modal) return;
        const focusableSelector = 'button:not(:disabled), textarea, select, input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])';
        const focusable = () => Array.from(modal.querySelectorAll<HTMLElement>(focusableSelector));
        const first = modal.querySelector<HTMLElement>('[autofocus]') || focusable()[0];
        first?.focus();
        const trapFocus = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return;
            const elements = focusable();
            if (!elements.length) return;
            const firstElement = elements[0];
            const lastElement = elements[elements.length - 1];
            if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        };
        modal.addEventListener('keydown', trapFocus);
        return () => modal.removeEventListener('keydown', trapFocus);
    }, []);

    return <div className="admin-modal-layer"><div className="admin-modal-backdrop" aria-hidden="true" onClick={onClose} /><section ref={modalRef} className="admin-modal" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId}><div className="admin-modal-heading"><div><h2 id={titleId}>{title}</h2><p id={descriptionId}>{description}</p></div><button type="button" className="admin-icon-button" onClick={onClose} aria-label="Zamknij okno"><X size={18} aria-hidden="true" /></button></div>{children}</section></div>;
}

function ModalActions({ primaryLabel, primaryIcon: PrimaryIcon, pending, onPrimary, onClose, danger = false }: { primaryLabel: string; primaryIcon: LucideIcon; pending: boolean; onPrimary: () => void; onClose: () => void; danger?: boolean }) {
    return <div className="admin-modal-actions"><button type="button" className={`admin-button ${danger ? 'admin-button--danger' : 'admin-button--primary'}`} onClick={onPrimary} disabled={pending}>{pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <PrimaryIcon size={16} aria-hidden="true" />}{pending ? 'Zapisywanie...' : primaryLabel}</button><button type="button" className="admin-button admin-button--secondary" onClick={onClose} disabled={pending}>Anuluj</button></div>;
}

function actionLabel(action: string) {
    const labels: Record<string, string> = { ban: 'Blokada', unban: 'Odblokowanie', kick: 'Wyrzucenie', make_admin: 'Nadanie admina', revoke_admin: 'Odebranie admina', reset_stats: 'Reset statystyk', notify: 'Komunikat', guest_ban: 'Blokada goscia', guest_unban: 'Odblokowanie goscia', guest_kick: 'Wyrzucenie goscia' };
    return labels[action] || action;
}

function formatDate(dateStr: string | null) {
    if (!dateStr) return 'Brak danych';
    const date = new Date(dateStr);
    return Number.isNaN(date.getTime()) ? 'Brak danych' : date.toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' });
}
