const LOWERCASE_RANKS = new Set(["A", "J", "Q", "K"]);

export function getCardAssetCode(cardCode: string) {
  if (cardCode === "cardBack") return cardCode;

  const rank = cardCode.slice(0, -1).toUpperCase();
  const suit = cardCode.slice(-1).toUpperCase();
  const fileRank = LOWERCASE_RANKS.has(rank) ? rank.toLowerCase() : rank;

  return `${fileRank}${suit}`;
}

export function getCardAssetPath(cardCode: string) {
  return `/blackjack/cards/${getCardAssetCode(cardCode)}.png`;
}
