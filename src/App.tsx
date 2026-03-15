import { useState } from "react";
import SetupGame, { type ProcessedSong } from "./components/SetupGame";
import Game from "./components/Game";

export function App() {
  const [gameState, setGameState] = useState<"setup" | "playing" | "finished">("setup");
  const [allSongs, setAllSongs] = useState<ProcessedSong[]>([]);
  const [gamePlaylist, setGamePlaylist] = useState<ProcessedSong[]>([]);

  const handleStartGame = (uploadedSongs: ProcessedSong[]) => {
    // 1. Save all songs for the suggestions dropdown
    setAllSongs(uploadedSongs);

    // 2. Shuffle and pick up to 10 songs
    const shuffled = [...uploadedSongs].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);
    
    setGamePlaylist(selected);
    setGameState("playing");
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
          onFinish={() => setGameState("finished")} 
        />
      )}

      {gameState === "finished" && (
        <div className="text-center space-y-6 mt-24">
          <h1 className="text-4xl font-bold">Game Over!</h1>
          <button 
            onClick={() => setGameState("setup")}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
}

export default App;