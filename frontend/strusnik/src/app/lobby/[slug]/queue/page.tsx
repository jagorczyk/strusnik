'use client';

import { Clock3, X } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import AccountRequiredState from '@/app/components/common/AccountRequiredState';
import ProfileAvatar from '@/app/components/profile/ProfileAvatar';
import ReturnArrow from '@/app/components/lobby/returnArrow';
import { useSocket } from '@/app/hooks/useSocket';
import { useUser } from '@/app/hooks/useUser';
import { useLang } from '@/app/lang';
import { t } from '@/app/i18n';
import styles from './queue.module.css';

type QueueStage = 'searching' | 'found' | 'ready' | 'error';

type MatchmakingOpponent = {
  username?: string;
  rating?: number | null;
  avatarUrl?: string | null;
};

type MatchmakingFoundPayload = {
  matchId?: string;
  opponent?: MatchmakingOpponent;
};

type MatchmakingStartedPayload = {
  roomId?: string;
  game?: string;
};

function gameRoute(game: string) {
  const normalized = game.toLowerCase();
  if (normalized === 'chess') return 'Chess';
  if (normalized === 'battleships') return 'Battleships';
  return 'Stratego';
}

export default function TournamentQueuePage() {
  const { lang } = useLang();
  const router = useRouter();
  const params = useParams<{ slug: string }>();
  const { socket, isConnected } = useSocket();
  const { userInfo, isLoading: isUserLoading } = useUser();
  const gameKey = String(params?.slug ?? 'chess').toLowerCase();
  const [stage, setStage] = useState<QueueStage>('searching');
  const [matchId, setMatchId] = useState<string | null>(null);
  const [opponent, setOpponent] = useState<MatchmakingOpponent | null>(null);
  const [queueSeconds, setQueueSeconds] = useState(0);
  const [myRating, setMyRating] = useState(500);
  const joinedRef = useRef(false);
  const startedRef = useRef(false);
  const cancelledRef = useRef(false);

  const copy = lang === 'pl'
    ? {
        title: 'Kolejka turniejowa',
        searching: 'Szukanie przeciwnika',
        searchingText: 'Szukamy rywala dla Twojej gry.',
        found: 'Przeciwnik znaleziony',
        starting: 'Przechodzimy do gry',
        waitingOpponent: 'Szukamy rywala',
        cancel: 'Anuluj wyszukiwanie',
        you: 'Ty',
        connection: 'Brak polaczenia z serwerem.',
        unavailable: 'Kolejka turniejowa jest chwilowo niedostepna.',
        back: 'Wroc do lobby',
      }
    : {
        title: 'Tournament queue',
        searching: 'Finding an opponent',
        searchingText: 'Finding an opponent for your game.',
        found: 'Opponent found',
        starting: 'Entering the game',
        waitingOpponent: 'Finding an opponent',
        cancel: 'Cancel search',
        you: 'You',
        connection: 'No connection to the server.',
        unavailable: 'The tournament queue is temporarily unavailable.',
        back: 'Back to lobby',
      };

  const myDisplayName = userInfo?.nickname || copy.you;

  useEffect(() => {
    if (!socket) return;

    const handleStatus = (data: { state?: string; rating?: number | null }) => {
      if (typeof data.rating === 'number') setMyRating(data.rating);
      if (data.state === 'searching') setStage('searching');
    };

    const handleFound = (data: MatchmakingFoundPayload) => {
      setMatchId(data.matchId || null);
      setOpponent(data.opponent || null);
      setStage('found');
    };

    const handleStarted = (data: MatchmakingStartedPayload) => {
      if (!data.roomId || !data.game) return;
      startedRef.current = true;
      router.push(`/games/${gameRoute(data.game)}/${data.roomId}?autojoin=true&role=player&matchmaking=true`);
    };

    const handleCancelled = (data: { requeued?: boolean }) => {
      if (data.requeued) {
        setQueueSeconds(0);
        setStage('searching');
        return;
      }
      router.push(`/lobby/${gameKey}`);
    };

    const handleError = () => setStage('error');

    socket.on('matchmaking_status', handleStatus);
    socket.on('matchmaking_found', handleFound);
    socket.on('matchmaking_started', handleStarted);
    socket.on('matchmaking_cancelled', handleCancelled);
    socket.on('matchmaking_error', handleError);

    return () => {
      socket.off('matchmaking_status', handleStatus);
      socket.off('matchmaking_found', handleFound);
      socket.off('matchmaking_started', handleStarted);
      socket.off('matchmaking_cancelled', handleCancelled);
      socket.off('matchmaking_error', handleError);
    };
  }, [gameKey, router, socket]);

  useEffect(() => {
    if (isUserLoading || !socket || !isConnected || joinedRef.current) return;
    if (userInfo?.isGuest) return;

    joinedRef.current = true;
    socket.emit('matchmaking_join', { game: gameKey, mode: 'ranked' });
  }, [gameKey, isConnected, isUserLoading, socket, userInfo?.isGuest]);

  useEffect(() => {
    if (stage !== 'searching') return;
    const interval = window.setInterval(() => setQueueSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [stage]);

  useEffect(() => {
    if (stage !== 'found' || !matchId || !socket) return;
    const timeout = window.setTimeout(() => {
      socket.emit('matchmaking_ready', { matchId });
      setStage('ready');
    }, 1400);
    return () => window.clearTimeout(timeout);
  }, [matchId, socket, stage]);

  useEffect(() => {
    return () => {
      if (joinedRef.current && !startedRef.current && !cancelledRef.current) {
        socket?.emit('matchmaking_cancel');
      }
    };
  }, [socket]);

  const cancelQueue = () => {
    cancelledRef.current = true;
    socket?.emit('matchmaking_cancel');
    router.push(`/lobby/${gameKey}`);
  };

  const isLoginRequired = !isUserLoading && Boolean(userInfo?.isGuest);
  const isSearching = stage === 'searching';
  const hasOpponent = stage === 'found' || stage === 'ready';
  const heading = stage === 'found' ? copy.found : stage === 'ready' ? copy.starting : copy.searching;
  const description = stage === 'searching' ? copy.searchingText : '';

  return (
    <main
      id="main-content"
      className={isLoginRequired ? `${styles.page} ${styles.pageAccountRequired}` : styles.page}
    >
      <ReturnArrow href={`/lobby/${gameKey}`} text={t(lang, 'arrow')} />

      {isLoginRequired ? (
        <AccountRequiredState backHref={`/lobby/${gameKey}`} backLabel={copy.back} />
      ) : (
        <section className={styles.queueView} aria-labelledby="tournament-queue-title" aria-live="polite">
          <p className={styles.kicker}>{copy.title}</p>
          <h1 id="tournament-queue-title">{heading}</h1>

          {stage === 'error' ? (
            <div className={styles.message} role="alert">
              <p>{isConnected ? copy.unavailable : copy.connection}</p>
            </div>
          ) : (
            <>
              {isSearching && <p className={styles.description}>{description}</p>}

              <section className={styles.people} aria-label="Uczestnicy kolejki">
                <div className={styles.person}>
                  <ProfileAvatar avatarUrl={userInfo?.avatarUrl} displayName={myDisplayName} />
                  <span><strong>{myDisplayName}</strong><small>{myRating} ELO</small></span>
                </div>
                <span className={styles.versus} aria-hidden="true">VS</span>
                <div className={styles.person}>
                  <ProfileAvatar avatarUrl={opponent?.avatarUrl} displayName={opponent?.username || '?'} />
                  <span>
                    <strong>{opponent?.username || copy.waitingOpponent}</strong>
                    {opponent?.rating ? <small>{opponent.rating} ELO</small> : null}
                  </span>
                </div>
              </section>

              {isSearching && (
                <div className={styles.timer}>
                  <Clock3 size={17} aria-hidden="true" />
                  <strong>{queueSeconds} s</strong>
                </div>
              )}

              {hasOpponent && <p className={styles.foundHint}>{copy.starting}</p>}
            </>
          )}

          <button type="button" className={styles.cancelAction} onClick={cancelQueue}>
            <X size={18} aria-hidden="true" />
            <span>{copy.cancel}</span>
          </button>
        </section>
      )}
    </main>
  );
}
