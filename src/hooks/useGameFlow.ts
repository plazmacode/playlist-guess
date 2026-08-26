import type { ProcessedSong } from "@/components/SetupGame";
import { shuffleArray, type GameResult } from "@/lib/game-utils";
import { useState } from "react";

export function useGameFlow() {
  const [gameState, setGameState] = useState<"setup" | "playing" | "finished">("setup");
  const [allSongs, setAllSongs] = useState<ProcessedSong[]>([]);
  const [gamePlaylist, setGamePlaylist] = useState<ProcessedSong[]>([]);

  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [gameSeed, setGameSeed] = useState<number | undefined>(undefined);

  const handleStartGame = (resultSongs: ProcessedSong[], seed?: number, maxSongs: number = 10, allSongs?: ProcessedSong[]) => {
    // 1. Save all songs for the suggestions dropdown. prefer all songs so it doesn't only show the songs that can be found in the current game.
    setAllSongs(allSongs || resultSongs);

    // 2. Shuffle and pick up to 10 songs
    const shuffled = shuffleArray(resultSongs, seed);
    const selected = shuffled.slice(0, maxSongs);
    
    setGamePlaylist(selected);
    setGameSeed(seed);
    setGameState("playing");
  };

  const handleFinishGame = (results: GameResult[]) => {
    setGameResults(results);
    setGameState("finished");
  };

  return {
    gameState,
    allSongs,
    gamePlaylist,
    gameResults,
    gameSeed,
    startGame: handleStartGame,
    finishGame: handleFinishGame,
    restartGame: () => setGameState("setup")
};
}