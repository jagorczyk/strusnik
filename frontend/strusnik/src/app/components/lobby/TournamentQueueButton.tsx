'use client';

import { Trophy } from 'lucide-react';
import Link from 'next/link';
import { useLang } from '@/app/lang';

const supportedGames = new Set(['chess', 'battleships', 'stratego']);

export default function TournamentQueueButton({ game }: { game: string }) {
  const { lang } = useLang();
  const gameKey = game.toLowerCase();
  if (!supportedGames.has(gameKey)) return null;
  const label = lang === 'pl' ? 'Kolejka turniejowa' : 'Tournament queue';

  return (
    <Link
      href={`/lobby/${gameKey}/queue`}
      className="lobby-queue-action"
      aria-label={label}
      title={label}
    >
      <Trophy size={20} strokeWidth={2} aria-hidden="true" />
    </Link>
  );
}
