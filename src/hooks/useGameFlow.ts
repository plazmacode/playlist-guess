import type { ProcessedSong } from "@/components/SetupGame";
import { shuffleArray, type GameResult } from "@/lib/game-utils";
import { useState } from "react";

export function useGameFlow() {
  const [gameState, setGameState] = useState<"setup" | "playing" | "finished">("setup");
  const [allSongs, setAllSongs] = useState<ProcessedSong[]>([]);
  const [gamePlaylist, setGamePlaylist] = useState<ProcessedSong[]>([]);

  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [gameSeed, setGameSeed] = useState<number | undefined>(undefined);

  const handleStartGame = (uploadedSongs: ProcessedSong[], seed?: number) => {
    // 1. Save all songs for the suggestions dropdown
    setAllSongs(uploadedSongs);

    // 2. Shuffle and pick up to 10 songs
    const shuffled = shuffleArray(uploadedSongs, seed);
    const selected = shuffled.slice(0, 10);
    
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