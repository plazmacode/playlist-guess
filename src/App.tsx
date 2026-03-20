import { useState } from "react";
import SetupGame, { type ProcessedSong } from "./components/SetupGame";
import Game, { type GameResult } from "./components/Game";
import EndScreen from "./components/EndScreen";
import { shuffleArray } from "./lib/game-utils";

export function App() {
  const [gameState, setGameState] = useState<"setup" | "playing" | "finished">("setup");
  const [allSongs, setAllSongs] = useState<ProcessedSong[]>([]);
  const [gamePlaylist, setGamePlaylist] = useState<ProcessedSong[]>([]);

  const [gameResults, setGameResults] = useState<GameResult[]>([]);

  const handleStartGame = (uploadedSongs: ProcessedSong[]) => {
    // 1. Save all songs for the suggestions dropdown
    setAllSongs(uploadedSongs);

    // 2. Shuffle and pick up to 10 songs
    const shuffled = shuffleArray(uploadedSongs);
    const selected = shuffled.slice(0, 10);
    
    setGamePlaylist(selected);
    setGameState("playing");
  };

  const handleFinishGame = (results: GameResult[]) => {
    setGameResults(results);
    setGameState("finished");
  };

  return (
    <div>
      {gameState === "setup" && (
        <SetupGame onStart={handleStartGame} />
      )}
      
      {gameState === "playing" && (
        <Game 
          playlist={gamePlaylist} 
          allSongs={allSongs} 
          onFinish={handleFinishGame} 
        />
      )}

      {gameState === "finished" && (
        <EndScreen 
          results={gameResults} 
          onRestart={() => setGameState("setup")} 
        />
      )}
    </div>
  );
}

export default App;