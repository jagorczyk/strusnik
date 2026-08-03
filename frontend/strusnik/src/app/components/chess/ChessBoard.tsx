'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';

type Color = 'w' | 'b';

type Props = {
  width: number;
  height: number;
  fen: string;
  myColor: Color | null;
  isGameStarted: boolean;
  isMyTurn: boolean;
  legalMovesBySquare: Record<string, string[]>;
  onMove: (from: string, to: string, promotion?: string) => void;
};

type DragState = {
  from: string;
  piece: { type: string; color: Color };
  offsetX: number;
  offsetY: number;
};

const FILES = 'abcdefgh';

function squareToCoords(square: string) {
  const fileIdx = FILES.indexOf(square[0]);
  const rankIdx = Number(square[1]) - 1;
  return { fileIdx, rankIdx };
}

function coordsToSquare(fileIdx: number, rankIdx: number) {
  return `${FILES[fileIdx]}${rankIdx + 1}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getPieceSprite(piece: { type: string; color: Color }) {
  const color = piece.color === 'w' ? 'white' : 'black';
  switch (piece.type) {
    case 'p':
      return `/chess/pieces/${color}_pawn.webp`;
    case 'r':
      return `/chess/pieces/${color}_rook.webp`;
    case 'n':
      return `/chess/pieces/${color}_knight.webp`;
    case 'b':
      return `/chess/pieces/${color}_bishop.webp`;
    case 'q':
      return `/chess/pieces/${color}_queen.webp`;
    case 'k':
      return `/chess/pieces/${color}_king.webp`;
    default:
      return null;
  }
}

function needsPromotion(piece: { type: string; color: Color }, toSquare: string) {
  if (piece.type !== 'p') return false;
  const toRank = Number(toSquare[1]);
  return (piece.color === 'w' && toRank === 8) || (piece.color === 'b' && toRank === 1);
}

const PIECE_TUNING: Record<Color, Record<string, { scale: number; y: number }>> = {
  w: {
    p: { scale: 0.725, y: -0.065 },
    r: { scale: 0.75, y: -0.0633 },
    n: { scale: 0.735, y: -0.0475 },
    b: { scale: 0.74, y: -0.05 },
    q: { scale: 0.73, y: -0.05 },
    k: { scale: 0.725, y: -0.05 },
  },
  b: {
    p: { scale: 0.73, y: -0.03 },
    r: { scale: 0.76, y: -0.055 },
    n: { scale: 0.74, y: -0.045 },
    b: { scale: 0.74, y: -0.045 },
    q: { scale: 0.74, y: -0.0424 },
    k: { scale: 0.74, y: -0.0435 },
  },
};

export default function ChessBoard({
  width,
  height,
  fen,
  myColor,
  isGameStarted,
  isMyTurn,
  legalMovesBySquare,
  onMove,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const IMG_W = 2048;
  const IMG_H = 1993;

  const PLAY_X = 279;
  const PLAY_Y = 209;
  const PLAY_W = 1506;
  const PLAY_H = 1530;

  const scaleX = width / IMG_W;
  const scaleY = height / IMG_H;

  const boardLeft = PLAY_X * scaleX;
  const boardTop = PLAY_Y * scaleY;
  const boardW = PLAY_W * scaleX;
  const boardH = PLAY_H * scaleY;

  const squareW = boardW / 8;
  const squareH = boardH / 8;

  const [drag, setDrag] = useState<DragState | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);

  const chess = useMemo(() => {
    try {
      return fen === 'start' ? new Chess() : new Chess(fen);
    } catch {
      return new Chess();
    }
  }, [fen]);

  const pieces = useMemo(() => {
    const out: Array<{ square: string; piece: { type: string; color: Color } }> = [];
    for (let r = 1; r <= 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = `${FILES[f]}${r}`;
        const p = chess.get(sq);
        if (p) out.push({ square: sq, piece: { type: p.type, color: p.color as Color } });
      }
    }
    return out;
  }, [chess]);

  const flip = myColor === 'b';

  const squareToPixel = (square: string) => {
    const { fileIdx, rankIdx } = squareToCoords(square);
    const f = flip ? 7 - fileIdx : fileIdx;
    const r = flip ? 7 - rankIdx : rankIdx;

    const yRank = 7 - r;
    return {
      x: boardLeft + f * squareW,
      y: boardTop + yRank * squareH,
    };
  };

  const pixelToSquare = (x: number, y: number) => {
    const rx = x - boardLeft;
    const ry = y - boardTop;
    if (rx < 0 || ry < 0 || rx >= boardW || ry >= boardH) return null;

    const file = Math.floor(rx / squareW);
    const yRank = Math.floor(ry / squareH);

    const r = 7 - yRank;
    const f = file;

    const fileIdx = flip ? 7 - f : f;
    const rankIdx = flip ? 7 - r : r;

    return coordsToSquare(fileIdx, rankIdx);
  };

  // Pointer coordinates come from the visual (zoomed) rectangle, while the
  // board layers use the component's unzoomed CSS dimensions.
  const getBoardPoint = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;

    return {
      x: (clientX - rect.left) * (width / rect.width),
      y: (clientY - rect.top) * (height / rect.height),
    };
  };

  const legalTargets = useMemo(() => {
    if (drag) return legalMovesBySquare?.[drag.from] ?? [];
    if (selectedSquare) return legalMovesBySquare?.[selectedSquare] ?? [];
    return [];
  }, [drag, selectedSquare, legalMovesBySquare]);

  const isDraggable = (square: string, piece: { type: string; color: Color }) => {
    if (!isGameStarted) return false;
    if (!isMyTurn) return false;
    if (!myColor) return false;
    if (piece.color !== myColor) return false;
    const moves = legalMovesBySquare?.[square];
    return Array.isArray(moves) && moves.length > 0;
  };

  const moveSelectedPiece = (toSquare: string) => {
    if (!selectedSquare) return false;

    const piece = chess.get(selectedSquare);
    const targets = legalMovesBySquare?.[selectedSquare] ?? [];
    if (!piece || !targets.includes(toSquare)) return false;

    const promo = needsPromotion({ type: piece.type, color: piece.color as Color }, toSquare) ? 'q' : undefined;
    onMove(selectedSquare, toSquare, promo);
    setSelectedSquare(null);
    return true;
  };

  const onPointerDownBoard = (e: React.PointerEvent) => {
    if (drag) return;

    const point = getBoardPoint(e.clientX, e.clientY);
    if (!point) return;

    const square = pixelToSquare(point.x, point.y);
    if (!square) return;
    if (moveSelectedPiece(square)) return;

    const piece = chess.get(square);
    if (piece && isDraggable(square, { type: piece.type, color: piece.color as Color })) {
      setSelectedSquare(square);
    } else {
      setSelectedSquare(null);
    }
  };

  const onPointerDownPiece = (
    e: React.PointerEvent,
    square: string,
    piece: { type: string; color: Color },
  ) => {
    if (!isDraggable(square, piece)) return;
    e.stopPropagation();
    setSelectedSquare(square);

    const point = getBoardPoint(e.clientX, e.clientY);
    if (!point) return;

    const { x, y } = squareToPixel(square);
    const px = point.x;
    const py = point.y;

    setDrag({
      from: square,
      piece,
      offsetX: px - (x + squareW / 2),
      offsetY: py - (y + squareH / 2),
    });
    setPointerPos({ x: px, y: py });

    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const point = getBoardPoint(e.clientX, e.clientY);
    if (!point) return;
    setPointerPos(point);
  };

  const finishDrag = (clientX: number, clientY: number) => {
    if (!drag) return;
    const point = getBoardPoint(clientX, clientY);
    if (!point) return;

    const px = point.x;
    const py = point.y;

    const toSq = pixelToSquare(px, py);
    const fromSq = drag.from;
    const piece = drag.piece;

    setDrag(null);
    setPointerPos(null);

    if (!toSq) return;
    const targets = legalMovesBySquare?.[fromSq] ?? [];
    if (!targets.includes(toSq)) return;

    const promo = needsPromotion(piece, toSq) ? 'q' : undefined;
    setSelectedSquare(null);
    onMove(fromSq, toSq, promo);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!drag) return;
    finishDrag(e.clientX, e.clientY);
  };

  const onPointerCancel = () => {
    if (!drag) return;
    setDrag(null);
    setPointerPos(null);
  };

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setDrag(null);
        setSelectedSquare(null);
        setPointerPos(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative select-none touch-none"
      style={{ width, height }}
      onPointerDown={onPointerDownBoard}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >

      <img
        src="/chess/chessboard.webp"
        alt="Chessboard"
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />

      {(drag || selectedSquare) &&
        legalTargets.map((sq) => {
          const { x, y } = squareToPixel(sq);
          return (
            <div
              key={`hl_${sq}`}
              className="absolute rounded-full"
              style={{
                left: x + squareW * 0.35,
                top: y + squareH * 0.35,
                width: squareW * 0.3,
                height: squareH * 0.3,
                background: 'rgba(255,255,255,0.35)',
              }}
            />
          );
        })}

      {pieces.map(({ square, piece }) => {
        const sprite = getPieceSprite(piece);
        const { x, y } = squareToPixel(square);
        const hiddenBecauseDragging = drag?.from === square;

        const t = PIECE_TUNING[piece.color][piece.type];

        const yOffsetPx = t.y * squareH;

        return (
          <div
            key={`${square}_${piece.color}${piece.type}`}
            className="absolute flex items-center justify-center"
            style={{
              left: x,
              top: y,
              width: squareW,
              height: squareH,
              opacity: hiddenBecauseDragging ? 0 : 1,
              cursor: isDraggable(square, piece) ? 'grab' : 'default',
            }}
            onPointerDown={(e) => onPointerDownPiece(e, square, piece)}
          >
            {sprite ? (
              <img
                src={sprite}
                alt={`${piece.color}${piece.type}`}
                draggable={false}
                style={{
                  width: `${t.scale * 100}%`,
                  height: `${t.scale * 100}%`,
                  objectFit: 'contain',
                  transform: `translateY(${yOffsetPx}px)`,
                }}
              />
            ) : null}
          </div>
        );
      })}

      {drag && pointerPos && (() => {
        const sprite = getPieceSprite(drag.piece);
        if (!sprite) return null;

        const t = PIECE_TUNING[drag.piece.color][drag.piece.type];
        const yOffsetPx = t.y * squareH;

        const cx = pointerPos.x - drag.offsetX;
        const cy = pointerPos.y - drag.offsetY;

        return (
          <div
            className="absolute pointer-events-none flex items-center justify-center"
            style={{
              left: clamp(cx - squareW / 2, 0, width - squareW),
              top: clamp(cy - squareH / 2, 0, height - squareH),
              width: squareW,
              height: squareH,
              filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.6))',
            }}
          >
            <img
              src={sprite}
              alt="drag"
              draggable={false}
              style={{
                width: `${t.scale * 100}%`,
                height: `${t.scale * 100}%`,
                objectFit: 'contain',
                transform: `translateY(${yOffsetPx}px)`,
              }}
            />
          </div>
        );
      })()}

      <img
        src="/chess/frame.webp"
        alt="Frame"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        draggable={false}
      />
    </div>
  );
}
