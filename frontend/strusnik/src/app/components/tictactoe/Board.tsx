import React from "react"

interface BoardProps {
    board: string[]
    onSquareClick: (index: number) => void
}

export default function Board({ board, onSquareClick }: BoardProps) {
    return (
        <div className="grid grid-cols-3 gap-3">
            {board.map((value, index) => (
                <button
                    key={index}
                    onClick={() => onSquareClick(index)}
                    disabled={value !== ""}
                    className="game-runtime-tictactoe-cell w-24 h-24 text-white text-4xl font-bold disabled:cursor-not-allowed transition-transform bg-no-repeat bg-center bg-cover"
                    style={{ backgroundImage: "url('/main/button.webp')" }}
                >
                    {value}
                </button>
            ))}
        </div>
    )
}
