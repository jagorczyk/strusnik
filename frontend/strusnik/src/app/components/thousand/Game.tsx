'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import GameCard from '../blackjack/gameCard';
import { useRouter } from 'next/navigation';
import { Clock3, Crown, Gavel, WifiOff } from 'lucide-react';
import PlayerTile from '@/app/components/multiplayer/PlayerTile';
import type { PlayerTileModel } from '@/app/components/multiplayer/types';
import { useLang } from '@/app/lang';
import { t } from '@/app/i18n';
import { getCardAssetPath } from '@/app/utils/cardAssets';

interface Player {
  socketId: string;
  userId: string;
  name: string;
  score: number;
  avatarUrl?: string | null;
  hasAvatar?: boolean;
  round_points?: number;
  connected?: boolean;
  disconnect_timestamp?: number;
}

interface Winner {
  name: string;
  score: number;
  userId: string;
}

interface CardOnTable {
  card: string;
  player?: string;
  userId?: string;
  player_id?: string;
}

interface ThousandGameState {
  seats?: (Player | null)[];
  active_user_id?: string | null;
  my_hand?: string[];
  current_bid?: number;
  dealer_idx?: number;
  winner?: Winner;
  stage?: string;
  stock_recipients?: number[];
  trump_suit?: string | null;
  stock?: string[];
  cards_on_table?: CardOnTable[];
}

interface FlyingCard {
  id: string;
  src: string;
  style: React.CSSProperties;
}

interface ActiveGameProps {
  socket: Socket | null;
  roomId: string;
  seats: (Player | null)[];
  myId: string;
  initialHand: string[];
}

function avatarUrlForPlayer(player: Player) {
  if (player.avatarUrl) return player.avatarUrl;
  if (player.hasAvatar === false || String(player.userId).startsWith('guest_')) return null;
  return `/api/profile/avatar/${encodeURIComponent(String(player.userId))}`;
}

const BigDisconnectOverlay = ({ timestamp, name }: { timestamp: number; name: string }) => {
  const { lang } = useLang();
  const [timeLeft, setTimeLeft] = useState(60);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now() / 1000;
      const validTimestamp = timestamp || now;
      const diff = 60 - (now - validTimestamp);
      setTimeLeft(diff > 0 ? Math.floor(diff) : 0);
    }, 1000);
    return () => clearInterval(interval);
  }, [timestamp]);

  const progress = Math.max(0, Math.min(100, (timeLeft / 60) * 100));

  return (
    <div className="thousand-disconnect-card" role="status" aria-live="polite">
      <div className="thousand-disconnect-card__icon" aria-hidden="true">
        <WifiOff size={14} strokeWidth={1.8} />
      </div>
      <div className="thousand-disconnect-card__copy">
        <p>{t(lang, 'thousand.disconnected')}</p>
        <span>{name}</span>
      </div>
      <div
        className="thousand-disconnect-card__timer"
        aria-label={t(lang, 'common.seconds_remaining').replace('{time}', String(timeLeft))}
      >
        <Clock3 size={12} strokeWidth={2} aria-hidden="true" />
        <strong>{timeLeft}</strong>
        <span>s</span>
      </div>
      <div className="thousand-disconnect-card__progress" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

export default function Game({ socket, roomId, seats: initialSeats, myId, initialHand }: ActiveGameProps) {
  const { lang } = useLang();
  const router = useRouter();

  const [gameSeats, setGameSeats] = useState<(Player | null)[]>(initialSeats);
  const [myHand, setMyHand] = useState<string[]>(initialHand);
  const [flyingCard, setFlyingCard] = useState<FlyingCard | null>(null);

  const [currentBid, setCurrentBid] = useState<number>(100);
  const [declarationAmount, setDeclarationAmount] = useState<number>(100);

  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [dealerIdx, setDealerIdx] = useState<number>(0);

  const [gameStage, setGameStage] = useState<string>('waiting_for_players');
  const [stockCards, setStockCards] = useState<string[]>([]);
  const [stockRecipients, setStockRecipients] = useState<number[]>([]);
  const [trumpSuit, setTrumpSuit] = useState<string | null>(null);

  const [cardsOnTable, setCardsOnTable] = useState<CardOnTable[]>([]);
  const [isInteractionLocked, setIsInteractionLocked] = useState<boolean>(false);
  const [winner, setWinner] = useState<Winner | null>(null);

  const [processingMove, setProcessingMove] = useState<boolean>(false);

  const lastProcessedCardRef = useRef<string | null>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const resultActionRef = useRef<HTMLButtonElement>(null);

  const pendingCardRef = useRef<string | null>(null);
  const fallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLeavingRoomRef = useRef(false);

  const localDistributedToRef = useRef<number[]>([]);

  const gameSeatsRef = useRef(gameSeats);
  const myIdRef = useRef(myId);
  const gameStageRef = useRef(gameStage);
  const dealerIdxRef = useRef(dealerIdx);

  useEffect(() => {
    gameSeatsRef.current = gameSeats;
  }, [gameSeats]);
  useEffect(() => {
    myIdRef.current = myId;
  }, [myId]);
  useEffect(() => {
    gameStageRef.current = gameStage;
  }, [gameStage]);
  useEffect(() => {
    dealerIdxRef.current = dealerIdx;
  }, [dealerIdx]);

  useEffect(() => {
    setDeclarationAmount(currentBid);
  }, [currentBid]);

  useEffect(() => {
    if (winner) resultActionRef.current?.focus();
  }, [winner]);

  const getMySeatIndex = () => {
    const idx = gameSeats.findIndex((s) => s && String(s.userId) === String(myId));
    return idx === -1 ? 0 : idx;
  };

  const isObserver = !gameSeats.some((s) => s && String(s.userId) === String(myId));
  const mySeatIndex = getMySeatIndex();
  const activePlayersCount = gameSeats.filter((s) => s !== null).length;
  const amIPausing = activePlayersCount === 4 && mySeatIndex === dealerIdx;

  const amIActive = () => {
    if (!activeUserId) return false;
    return String(activeUserId) === String(myId);
  };

  const getPlayerAtScreenPos = (offset: number) => {
    const myIdx = getMySeatIndex();
    const targetIdx = (myIdx + offset) % 4;
    return { data: gameSeats[targetIdx], seatIndex: targetIdx };
  };

  const isCardValid = (cardCode: string): boolean => {
    if (amIPausing) return false;
    if (gameStage !== 'playing') return true;
    if (cardsOnTable.length === 0) return true;

    const leadCard = cardsOnTable[0].card;
    const leadSuit = leadCard.slice(-1);
    const cardSuit = cardCode.slice(-1);

    const hasLeadSuit = myHand.some((c) => c.slice(-1) === leadSuit);
    const hasTrump = trumpSuit ? myHand.some((c) => c.slice(-1) === trumpSuit) : false;

    if (hasLeadSuit) return cardSuit === leadSuit;
    if (hasTrump && trumpSuit) return cardSuit === trumpSuit;
    return true;
  };

  const handleExit = () => {
    router.push(`/lobby/Tysiac`);
  };

  const animateCardMove = useCallback((startRect: DOMRect, cardCode: string, startRotation: number = 0) => {
    if (!centerRef.current) return;
    const endRect = centerRef.current.getBoundingClientRect();
    const DURATION = 600;
    const TARGET_CARD_HEIGHT = 120;
    const TARGET_CARD_WIDTH = TARGET_CARD_HEIGHT * (2 / 3);

    setFlyingCard({
      id: cardCode,
      src: getCardAssetPath(cardCode),
      style: {
        position: 'fixed',
        top: startRect.top,
        left: startRect.left,
        width: startRect.width,
        height: startRect.height,
        zIndex: 9999,
        transition: `top ${DURATION}ms cubic-bezier(0.32, 0.72, 0, 1), left ${DURATION}ms cubic-bezier(0.32, 0.72, 0, 1), width ${DURATION}ms cubic-bezier(0.32, 0.72, 0, 1), height ${DURATION}ms cubic-bezier(0.32, 0.72, 0, 1), transform ${DURATION}ms cubic-bezier(0.32, 0.72, 0, 1)`,
        pointerEvents: 'none',
        transform: `rotate(${startRotation}deg)`,
        transformOrigin: 'center center',
      },
    });

    setTimeout(() => {
      setFlyingCard((prev) =>
        prev
          ? {
            ...prev,
            style: {
              ...prev.style,
              top: endRect.top + (endRect.height - TARGET_CARD_HEIGHT) / 2,
              left: endRect.left + (endRect.width - TARGET_CARD_WIDTH) / 2,
              width: TARGET_CARD_WIDTH,
              height: TARGET_CARD_HEIGHT,
              transform: 'rotate(0deg)',
            },
          }
          : null
      );
    }, 50);

    setTimeout(() => {
      setFlyingCard(null);
    }, DURATION + 100);
  }, []);

  const handleOpponentPlay = useCallback((playerPos: 'top' | 'left' | 'right', cardCode: string) => {
    const cardH = 120;
    const cardW = cardH * (2 / 3);
    let startTop = 0;
    let startLeft = 0;
    let startRotation = 0;

    if (playerPos === 'top') {
      startRotation = 180;
      startTop = -cardH;
      startLeft = window.innerWidth / 2 - cardW / 2;
    } else if (playerPos === 'left') {
      startRotation = -90;
      startTop = window.innerHeight / 2 - cardH / 2;
      startLeft = -cardW;
    } else if (playerPos === 'right') {
      startRotation = 90;
      startTop = window.innerHeight / 2 - cardH / 2;
      startLeft = window.innerWidth;
    }

    animateCardMove({ top: startTop, left: startLeft, width: cardW, height: cardH } as DOMRect, cardCode, startRotation);
  }, [animateCardMove]);

  useEffect(() => {
    if (!socket) return;
    isLeavingRoomRef.current = false;

    const handleGameState = (state: ThousandGameState) => {
      setProcessingMove(false);
      if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
      pendingCardRef.current = null;

      if (state.seats !== undefined) setGameSeats(state.seats);
      if (state.active_user_id !== undefined) setActiveUserId(state.active_user_id);
      if (state.my_hand !== undefined) setMyHand(state.my_hand);
      if (state.current_bid !== undefined) setCurrentBid(state.current_bid);
      if (state.dealer_idx !== undefined) setDealerIdx(state.dealer_idx);

      if (state.winner) {
        setWinner(state.winner);
        setGameStage('game_over');
      }

      if (state.stage !== undefined) {
        const newStage = state.stage;
        const prevStage = gameStageRef.current;

        if (newStage !== 'distributing') {
          localDistributedToRef.current = [];
        }

        if ((newStage === 'declaring' || newStage === 'distributing') && prevStage === 'stock_reveal') {
          setIsInteractionLocked(true);
          setTimeout(() => {
            setIsInteractionLocked(false);
          }, 1200);
        }
        setGameStage(newStage);
      }

      if (state.stock_recipients !== undefined) setStockRecipients(state.stock_recipients);
      if (state.trump_suit !== undefined) setTrumpSuit(state.trump_suit);

      if (state.stock && state.stock.length > 0) {
        setStockCards(state.stock);
      } else {
        const incomingStage = state.stage !== undefined ? state.stage : gameStageRef.current;
        const incomingDealerIdx = state.dealer_idx !== undefined ? state.dealer_idx : dealerIdxRef.current;
        const incomingSeats = state.seats !== undefined ? state.seats : gameSeatsRef.current;
        const myIdVal = myIdRef.current;
        const myIdx = incomingSeats.findIndex((s: Player | null) => s && String(s.userId) === String(myIdVal));
        const isFourPlayers = incomingSeats.filter((s) => s !== null).length === 4;
        const amIPausingNow = isFourPlayers && myIdx === incomingDealerIdx;
        const isRevealPhase = incomingStage === 'stock_reveal';
        const isBiddingPhase = incomingStage === 'bidding';

        if (isRevealPhase || (amIPausingNow && isBiddingPhase)) {
        } else {
          setStockCards([]);
        }
      }

      if (state.cards_on_table !== undefined) {
        setCardsOnTable([...state.cards_on_table]);
      }
    };

    const handleSocketError = (data: unknown) => {
      if (isLeavingRoomRef.current) return;

      console.error(t(lang, 'thousand.log.game_error'), data);
      const pendingCard = pendingCardRef.current;
      if (!pendingCard) {
        setProcessingMove(false);
        return;
      }

      setMyHand((prev) => {
        if (!prev.includes(pendingCard)) return [...prev, pendingCard];
        return prev;
      });
      pendingCardRef.current = null;
      setProcessingMove(false);
      if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
      socket.emit('sync_state', { roomId });
    };

    const handleGameEndedTimeout = () => {
      router.push(`/lobby/Tysiac`);
    };

    socket.on('game_state_update', handleGameState);
    socket.on('error', handleSocketError);
    socket.on('game_ended_timeout', handleGameEndedTimeout);
    socket.emit('sync_state', { roomId });

    return () => {
      isLeavingRoomRef.current = true;
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
      pendingCardRef.current = null;
      socket.off('game_state_update', handleGameState);
      socket.off('error', handleSocketError);
      socket.off('game_ended_timeout', handleGameEndedTimeout);
    };
  }, [socket, roomId, router, lang]);

  useEffect(() => {
    if (cardsOnTable.length === 0) return;
    const newCard = cardsOnTable[cardsOnTable.length - 1];
    const isNewCard = newCard.card !== lastProcessedCardRef.current;

    if (isNewCard) {
      lastProcessedCardRef.current = newCard.card;
      const currentSeats = gameSeatsRef.current;
      const currentMyId = myIdRef.current;

      const throwerSeat = currentSeats.find((s) => {
        if (!s) return false;
        if (newCard.userId && String(s.userId) === String(newCard.userId)) return true;
        if (newCard.player_id && s.socketId === newCard.player_id) return true;
        return false;
      });

      if (throwerSeat && String(throwerSeat.userId) !== String(currentMyId)) {
        const throwerIndex = currentSeats.indexOf(throwerSeat);
        const myIndex = currentSeats.findIndex((s) => s && String(s.userId) === String(currentMyId));
        const safeMyIndex = myIndex === -1 ? 0 : myIndex;
        const relPos = (throwerIndex - safeMyIndex + 4) % 4;

        if (relPos === 1) handleOpponentPlay('right', newCard.card);
        if (relPos === 2) handleOpponentPlay('top', newCard.card);
        if (relPos === 3) handleOpponentPlay('left', newCard.card);
      }
    }
  }, [cardsOnTable, handleOpponentPlay]);

  const trickSize = activePlayersCount === 4 ? 3 : activePlayersCount;
  const isTrickFull = activePlayersCount > 0 && cardsOnTable.length >= trickSize;

  const handleBid = () => {
    if (socket && amIActive()) socket.emit('player_move', { roomId, move: { type: 'bid', amount: currentBid + 10 } });
  };
  const handlePass = () => {
    if (socket && amIActive()) socket.emit('player_move', { roomId, move: { type: 'pass' } });
  };

  const handleDeclareScore = () => {
    if (socket && amIActive()) {
      socket.emit('player_move', { roomId, move: { type: 'declare_score', amount: Number(declarationAmount) } });
    }
  };

  const handleCardClick = (e: React.MouseEvent, cardCode: string) => {
    if (processingMove || flyingCard || isInteractionLocked || isTrickFull || amIPausing) return;

    if (gameStage === 'playing' && amIActive()) {
      if (!isCardValid(cardCode)) return;
      handleMyPlay(e, cardCode);
      return;
    }

    if (gameStage === 'distributing' && amIActive()) {
      const myIdx = getMySeatIndex();
      const opponentsIndices: number[] = [];
      let checkIdx = (myIdx + 1) % 4;

      for (let i = 0; i < 3; i++) {
        const isPausingDealer = activePlayersCount === 4 && checkIdx === dealerIdx;

        if (gameSeats[checkIdx] && !isPausingDealer) {
          opponentsIndices.push(checkIdx);
        }
        checkIdx = (checkIdx + 1) % 4;
      }

      const alreadyReceived = new Set([...stockRecipients, ...localDistributedToRef.current]);
      let targetIdx = opponentsIndices.find((idx) => !alreadyReceived.has(idx));

      if (targetIdx === undefined && opponentsIndices.length > 0) {
        targetIdx = opponentsIndices[0];
      }

      if (targetIdx !== undefined && socket) {
        setProcessingMove(true);

        localDistributedToRef.current.push(targetIdx);

        pendingCardRef.current = cardCode;
        lastProcessedCardRef.current = cardCode;

        setMyHand((prev) => prev.filter((c) => c !== cardCode));

        socket.emit('player_move', {
          roomId,
          move: { type: 'give_card', card: cardCode, target_idx: targetIdx },
        });

        if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = setTimeout(() => {
          console.warn(t(lang, 'thousand.log.no_server_response_distribute'));
          setMyHand((prev) => {
            if (!prev.includes(cardCode)) return [...prev, cardCode];
            return prev;
          });
          setProcessingMove(false);
          pendingCardRef.current = null;
          if (socket) socket.emit('sync_state', { roomId });
        }, 3000);
      }
    }
  };

  const handleMyPlay = (e: React.MouseEvent, cardCode: string) => {
    const startRect = (e.currentTarget as HTMLElement).getBoundingClientRect();

    setProcessingMove(true);
    pendingCardRef.current = cardCode;
    lastProcessedCardRef.current = cardCode;

    setMyHand((prev) => prev.filter((c) => c !== cardCode));
    animateCardMove(startRect, cardCode, 0);

    if (socket) socket.emit('player_move', { roomId, move: { type: 'play_card', card: cardCode } });

    if (fallbackTimeoutRef.current) clearTimeout(fallbackTimeoutRef.current);
    fallbackTimeoutRef.current = setTimeout(() => {
      console.warn(t(lang, 'thousand.log.no_server_response_move'));
      setMyHand((prev) => {
        if (!prev.includes(cardCode)) return [...prev, cardCode];
        return prev;
      });
      setProcessingMove(false);
      pendingCardRef.current = null;
      if (socket) socket.emit('sync_state', { roomId });
    }, 3000);
  };

  const PlayerInfo = ({ offset }: { offset: number }) => {
    const { data, seatIndex } = getPlayerAtScreenPos(offset);
    const isMe = !isObserver && data && String(data.userId) === String(myId);
    const isActive = Boolean(data && activeUserId && String(data.userId) === String(activeUserId));
    const isPausingPlayer = activePlayersCount === 4 && seatIndex === dealerIdx;

    if (!data) {
      return (
        <div className="thousand-player-seat thousand-player-seat--empty" role="group">
          <span className="thousand-player-seat__dot" aria-hidden="true" />
          <span>{t(lang, 'thousand.empty')}</span>
        </div>
      );
    }

    const isConnected = data.connected !== false;

    const model: PlayerTileModel = {
      id: String(data.userId || data.socketId),
      displayName: data.name,
      avatarUrl: avatarUrlForPlayer(data),
      isSelf: Boolean(isMe),
      selfLabel: t(lang, 'thousand.you'),
      role: 'player',
      connection: isConnected ? 'connected' : 'disconnected',
      activity: isActive ? 'active' : 'playing',
      activityLabel: isPausingPlayer ? t(lang, 'thousand.pausing') : isActive ? t(lang, 'thousand.your_turn') : t(lang, 'thousand.wait'),
      metric: { label: t(lang, 'thousand.points_short'), value: String(data.score) },
      outcome: winner ? (String(winner.userId) === String(data.userId) ? 'won' : 'lost') : undefined,
    };

    return (
      <div className={`thousand-player-seat${isMe ? ' is-you' : ''}${isActive ? ' is-active' : ''}${isPausingPlayer ? ' is-pausing' : ''}`}>
        <PlayerTile model={model} variant={isObserver ? 'observer' : winner ? 'finished' : 'active'} compact className="thousand-player-tile" />
        {!isConnected && data.disconnect_timestamp && (
          <div className="thousand-player-seat__offline">
            <BigDisconnectOverlay timestamp={data.disconnect_timestamp} name={data.name} />
          </div>
        )}
      </div>
    );
  };

  const OpponentCards = ({ offset, count }: { offset: number; count: number }) => {
    const isPausingPlayer = activePlayersCount === 4 && (getMySeatIndex() + offset) % 4 === dealerIdx;
    if (!isPlayerConnected(offset) || isPausingPlayer) return null;

    return (
      <div className="thousand-opponent-cards" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <span key={index} className="thousand-opponent-card" />
        ))}
      </div>
    );
  };

  const isMyTurn = amIActive();

  const stageLabels: Record<string, string> = lang === 'pl'
    ? {
      waiting_for_players: 'Przygotowanie',
      stock_reveal: 'Odkrywanie stosu',
      bidding: 'Licytacja',
      declaring: 'Deklarowanie',
      distributing: 'Rozdawanie kart',
      playing: 'Rozgrywka',
      game_over: 'Koniec rundy',
    }
    : {
      waiting_for_players: 'Preparing',
      stock_reveal: 'Stock reveal',
      bidding: 'Bidding',
      declaring: 'Declaring',
      distributing: 'Dealing cards',
      playing: 'Playing',
      game_over: 'Round over',
    };
  const stageLabel = stageLabels[gameStage] || gameStage;
  const cardWord = lang === 'pl' ? 'Karta' : 'Card';
  const turnLabel = isObserver || amIPausing
    ? t(lang, 'thousand.observing')
    : isMyTurn
      ? t(lang, 'thousand.your_turn')
      : t(lang, 'thousand.wait');
  const flyingCardIsOnTable = Boolean(flyingCard && cardsOnTable[cardsOnTable.length - 1]?.card === flyingCard.id);
  const visibleTableCards = flyingCardIsOnTable ? cardsOnTable.slice(0, -1) : cardsOnTable;

  const getSuitIcon = (suit: string) => {
    const icons: Record<string, string> = { H: '♥', D: '♦', C: '♣', S: '♠' };
    const colorClass = suit === 'H' || suit === 'D' ? 'is-red' : 'is-black';
    return <span className={`thousand-suit ${colorClass}`} aria-hidden="true">{icons[suit] || '?'}</span>;
  };

  const isPlayerConnected = (offset: number) => {
    const { data } = getPlayerAtScreenPos(offset);
    return data ? data.connected !== false : true;
  };

  const amIConnected = () => {
    const { data } = getPlayerAtScreenPos(0);
    return data ? data.connected !== false : true;
  };

  return (
    <div className="game-runtime-game game-runtime-thousand">
      {winner && (
        <div className="thousand-result-overlay" role="dialog" aria-modal="true" aria-labelledby="thousand-result-title">
          <div className="thousand-result-card">
            <div className="thousand-result-icon" aria-hidden="true"><Crown size={28} strokeWidth={1.8} /></div>
            <p className="thousand-result-kicker">{t(lang, 'thousand.game_over')}</p>
            <h1 id="thousand-result-title">{t(lang, 'thousand.winner_label')}</h1>
            <p className="thousand-result-winner">{winner.name}</p>
            <div className="thousand-result-score">
              <span>{t(lang, 'thousand.score_label')}</span>
              <strong>{winner.score}</strong>
            </div>
            <button ref={resultActionRef} type="button" onClick={handleExit} className="game-runtime-button game-runtime-button--primary thousand-result-action">
              {t(lang, 'thousand.back_to_lobby')}
            </button>
          </div>
        </div>
      )}

      {flyingCard && (
        <img
          src={flyingCard.src}
          style={flyingCard.style}
          className="thousand-flying-card"
          alt={t(lang, 'thousand.flying_card_alt')}
        />
      )}

      <header className="thousand-game-header" inert={Boolean(winner)} aria-hidden={winner ? true : undefined}>
        <div className="thousand-game-heading">
          <span className="thousand-game-heading__eyebrow">STRUSNIK / ONLINE TABLE</span>
          <h1>{t(lang, 'games.tysiac')}</h1>
        </div>
      </header>

      <div className="thousand-game-header__meta" inert={Boolean(winner)} aria-hidden={winner ? true : undefined}>
        <div className={`thousand-stage-pill${isMyTurn ? ' is-active' : ''}`} aria-live="polite">
          <span className="thousand-stage-pill__dot" aria-hidden="true" />
          <span>{stageLabel}</span>
        </div>
        <div className="thousand-header-stat">
          <span>{t(lang, 'thousand.stake')}</span>
          <strong>{currentBid}</strong>
        </div>
        {trumpSuit && (
          <div className="thousand-header-stat thousand-header-stat--trump">
            <span>{t(lang, 'thousand.trump')}</span>
            {getSuitIcon(trumpSuit)}
          </div>
        )}
      </div>

      <div className="game-runtime-thousand-layout thousand-layout" inert={Boolean(winner)} aria-hidden={winner ? true : undefined}>
        <div className="thousand-board-column">
          <section className="game-runtime-table thousand-table" aria-label={t(lang, 'games.tysiac')}>
            <span className="thousand-table__mark thousand-table__mark--top" aria-hidden="true">♠</span>
            <span className="thousand-table__mark thousand-table__mark--bottom" aria-hidden="true">♣</span>

            <div className="thousand-table__top">
              <PlayerInfo offset={2} />
              <OpponentCards offset={2} count={7} />
            </div>

            <div className="thousand-table__bottom">
              {amIConnected() && (
                <div className="thousand-hand-block">
                  <div className="thousand-hand-heading">
                    <span>{isMyTurn ? t(lang, 'thousand.your_turn') : t(lang, 'thousand.you')}</span>
                    <span className="thousand-hand-count">{myHand.length} / 7</span>
                  </div>
                  <div className="thousand-hand" aria-label={t(lang, 'thousand.your_preview')}>
                    {(myHand || []).map((card, index) => {
                      const isValid = isCardValid(card);
                      const isInteractive =
                        !processingMove &&
                        !isInteractionLocked &&
                        !isTrickFull &&
                        isMyTurn &&
                        (gameStage === 'playing' || gameStage === 'distributing');

                      return (
                        <button
                          key={card}
                          type="button"
                          disabled={!isInteractive || !isValid}
                          aria-label={`${cardWord} ${card}`}
                          onClick={(e) => handleCardClick(e, card)}
                          className={`thousand-hand-card${isInteractive && isValid ? ' is-valid' : ''}${isInteractive && !isValid ? ' is-invalid' : ''}`}
                          style={{ animationDelay: `${index * 55}ms` }}
                        >
                          <img src={getCardAssetPath(card)} alt="" draggable={false} />
                        </button>
                      );
                    })}
                  </div>
                  {amIPausing && <span className="thousand-dealer-note">{t(lang, 'thousand.dealer')}</span>}
                </div>
              )}
              <PlayerInfo offset={0} />
            </div>

            <div className="thousand-table__side thousand-table__side--left">
              <PlayerInfo offset={3} />
              <OpponentCards offset={3} count={5} />
            </div>

            <div className="thousand-table__side thousand-table__side--right">
              <PlayerInfo offset={1} />
              <OpponentCards offset={1} count={5} />
            </div>

            {trumpSuit && (
              <div className="thousand-table__trump" aria-label={`${t(lang, 'thousand.trump')}: ${trumpSuit}`}>
                <span>{t(lang, 'thousand.trump')}</span>
                {getSuitIcon(trumpSuit)}
              </div>
            )}

            <div ref={centerRef} className="thousand-table__center">
              {(gameStage === 'stock_reveal' || gameStage === 'bidding') && stockCards.length > 0 && (
                <div className="thousand-stock-reveal">
                  {gameStage === 'bidding' && <p>{t(lang, 'thousand.your_preview')}</p>}
                  <div className="thousand-stock-cards">
                    {stockCards.map((card, index) => (
                      <div key={`${card}-${index}`} className="thousand-stock-card" style={{ animationDelay: `${index * 90}ms` }}>
                        <GameCard cardName={card} className="thousand-stock-card__game-card" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {gameStage === 'bidding' && !stockCards.length && (
                <div className="thousand-stock-reveal thousand-stock-reveal--hidden">
                  <div className="thousand-stock-cards">
                    {[1, 2, 3].map((index) => (
                      <img key={index} src="/blackjack/cards/cardBack.png" className="thousand-hidden-card" alt="" />
                    ))}
                  </div>
                  <div className="thousand-stake-display">
                    <span>{t(lang, 'thousand.stake')}</span>
                    <strong>{currentBid}</strong>
                  </div>
                </div>
              )}

              {gameStage === 'playing' && visibleTableCards.length > 0 && (
                <div className="thousand-trick" aria-live="polite">
                  {visibleTableCards.map((tableCard, index) => {
                    const offset = index - (visibleTableCards.length - 1) / 2;
                    return (
                      <img
                        key={`${tableCard.card}-${index}`}
                        src={getCardAssetPath(tableCard.card)}
                        className="thousand-trick-card"
                        style={{
                          transform: `translate(-50%, -50%) translate(${offset * 14}px, ${Math.abs(offset) * 3}px) rotate(${offset * 6}deg)`,
                          zIndex: index + 1,
                        }}
                        alt={t(lang, 'thousand.table_card_alt')}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="game-runtime-side-panel thousand-control-rail" aria-label={t(lang, 'thousand.status')}>
          <div className="thousand-rail-heading">
            <div>
              <span className="thousand-rail-heading__eyebrow">{stageLabel}</span>
              <h2>{turnLabel}</h2>
            </div>
            <span className={`thousand-turn-icon${isMyTurn ? ' is-active' : ''}`} aria-hidden="true">
              <Clock3 size={18} strokeWidth={1.8} />
            </span>
          </div>

          <div className="thousand-rail-summary" aria-live="polite">
            <div>
              <span>{t(lang, 'thousand.status')}</span>
              <strong>{activePlayersCount} / 4</strong>
            </div>
            <div>
              <span>{t(lang, 'thousand.stake')}</span>
              <strong>{currentBid} {t(lang, 'thousand.points_short')}</strong>
            </div>
          </div>

          <div className="thousand-rail-actions">
            {gameStage === 'bidding' && !amIPausing && (
              <>
                <button type="button" onClick={handleBid} disabled={!isMyTurn} className="game-runtime-button game-runtime-button--primary thousand-action-button">
                  <Gavel size={16} strokeWidth={2} aria-hidden="true" />
                  <span>{t(lang, 'thousand.bid')}</span>
                  <small>{currentBid + 10}</small>
                </button>
                <button type="button" onClick={handlePass} disabled={!isMyTurn} className="game-runtime-button thousand-action-button">
                  <span>{t(lang, 'thousand.pass')}</span>
                </button>
              </>
            )}

            {gameStage === 'declaring' && (
              <div className="thousand-declare-form">
                {isMyTurn ? (
                  <>
                    <label htmlFor="thousand-declaration">{t(lang, 'thousand.your_game')}</label>
                    <input
                      id="thousand-declaration"
                      type="number"
                      step="10"
                      min={currentBid}
                      value={declarationAmount}
                      onChange={(e) => setDeclarationAmount(Number(e.target.value))}
                    />
                    <button type="button" onClick={handleDeclareScore} disabled={declarationAmount < currentBid} className="game-runtime-button game-runtime-button--primary thousand-action-button">
                      {t(lang, 'thousand.confirm')}
                    </button>
                  </>
                ) : (
                  <div className="thousand-waiting-callout" role="status">{t(lang, 'thousand.player_setting_score')}</div>
                )}
              </div>
            )}

            {gameStage === 'stock_reveal' && (
              <div className="thousand-waiting-callout thousand-waiting-callout--accent" role="status">
                {t(lang, 'thousand.fetching_stock')}
              </div>
            )}

            {gameStage === 'playing' && (
              <div className={`thousand-waiting-callout${isMyTurn ? ' thousand-waiting-callout--accent' : ''}`} role="status">
                {isMyTurn ? t(lang, 'thousand.your_turn') : t(lang, 'thousand.wait')}
              </div>
            )}
          </div>

          <div className="thousand-rail-tip">
            <span aria-hidden="true">♠</span>
            <p>{lang === 'pl' ? 'Zagraj karte zgodnie z kolorem wyjsciowym, jesli ja masz.' : 'Follow the lead suit when you have one.'}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}