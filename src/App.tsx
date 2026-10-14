import { useSyncExternalStore, useState } from "react";
import AdminPage from "./components/admin/AdminPage";
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

// Hash routing keeps the static hosting setup unchanged: "#/admin" opens the admin page.
function useHash() {
  return useSyncExternalStore(
    (listener) => {
      window.addEventListener("hashchange", listener);
      return () => window.removeEventListener("hashchange", listener);
    },
    () => window.location.hash
  );
}

export function App() {
  const { isLoggedIn, isAdmin, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const isAdminRoute = useHash() === "#/admin";

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
    playlists,
    fetchSongs,
    fetchPlaylists,
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
            playlists={playlists}
            fetchPlaylists={fetchPlaylists}
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
      <div className="flex justify-end gap-2 p-2">
        {isAdmin && (
          <Button asChild variant="outline" className="h-12 px-8 text-lg">
            <a href={isAdminRoute ? "#" : "#/admin"}>{isAdminRoute ? "Back to game" : "Admin"}</a>
          </Button>
        )}
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
      {isAdminRoute ? <AdminPage /> : renderScreen()}
    </div>
  );
}

export default App;