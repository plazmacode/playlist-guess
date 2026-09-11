import { useState } from "react";
import EndScreen from "./components/EndScreen";
import Game from "./components/Game";
import { useGameFlow } from "./hooks/useGameFlow";
import SetupGame from "./components/SetupGame";
import { useStreamingAPI } from "./hooks/useStreamingAPI";
import { useAuth } from "./hooks/useAuth";
import LoginForm from "./components/LoginForm";
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog";

export function App() {
  const { isLoggedIn, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  const {
    gameState,
    allSongs,
    gamePlaylist,
    gameResults,
    gameSeed,
    startGame,
    finishGame,
    restartGame
  } = useGameFlow();

  const {
    status,
    songs,
    folders,
    fetchSongs,
    fetchFolders,
    fetchPlaylist,
    getStreamUrl
  } = useStreamingAPI();


    const renderScreen = () => {
    switch (gameState) {
      case "setup":
        return (
          <SetupGame
            onStart={startGame}
            status={status}
            fetchSongs={fetchSongs}
            apiSongs={songs}
            getStreamUrl={getStreamUrl}
            folders={folders}
            fetchFolders={fetchFolders}
            fetchPlaylist={fetchPlaylist}
          />
        );
      case "playing":
        return <Game playlist={gamePlaylist} allSongs={allSongs} onFinish={finishGame} seed={gameSeed}/>;
      case "finished":
        return <EndScreen results={gameResults} onRestart={restartGame} />;
    }
  };


  return (
    <div>
      <div className="flex justify-end p-2">
        {isLoggedIn ? (
          <Button className="h-12 px-8 text-lg bg-pink-600 hover:bg-pink-800 transition-colors text-white" onClick={logout}>
            Log out
          </Button>
        ) : (
          <Dialog open={loginOpen} onOpenChange={setLoginOpen}>
            <DialogTrigger asChild>
              <Button className="h-12 px-8 text-lg bg-pink-600 hover:bg-pink-800 transition-colors text-white">
                Log in
              </Button>
            </DialogTrigger>
            <DialogContent className="top-20 translate-y-0">
              <DialogHeader>
                <DialogTitle>Log in for the full catalogue</DialogTitle>
              </DialogHeader>
              <LoginForm onSuccess={() => setLoginOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>
      {renderScreen()}
    </div>
  );
}

export default App;