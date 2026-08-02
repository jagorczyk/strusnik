import React, { useState, useEffect } from 'react'
import { getCardAssetPath } from '@/app/utils/cardAssets';

interface GameCardProps {
    cardName: string;
    className?: string;
}

export default function GameCard({
    cardName,
    className = "w-24",
}: GameCardProps) {
    const shouldBeRevealed = cardName !== "cardBack";
    const [isAnimatingRevealed, setIsAnimatingRevealed] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsAnimatingRevealed(shouldBeRevealed);
        }, shouldBeRevealed ? 50 : 0);
        return () => clearTimeout(timer);
    }, [shouldBeRevealed]);

    return (
        <div
            className={`relative aspect-2/3 ${className} perspective-[1000px]`}
        >
            <div
                className={`
                    w-full h-full relative transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]
                    transform-3d 
                    ${isAnimatingRevealed ? 'transform-[rotateY(180deg)]' : ''}
                `}
            >
                <div className="absolute inset-0 w-full h-full backface-hidden transform-[rotateY(180deg)]">
                    {shouldBeRevealed && (
                        <img
                            src={getCardAssetPath(cardName)}
                            alt={cardName}
                            className="w-full h-full object-contain drop-shadow-xl rounded-lg"
                        />
                    )}
                </div>

                <div className="absolute inset-0 w-full h-full backface-hidden">
                    <img
                        src="/blackjack/cards/cardBack.png"
                        alt="Card Back"
                        className="w-full h-full object-contain drop-shadow-xl rounded-lg"
                    />
                </div>
            </div>
        </div>
    )
}