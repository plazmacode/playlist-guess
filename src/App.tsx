import EndScreen from "./components/EndScreen";
import Game from "./components/Game";
import { useGameFlow } from "./hooks/useGameFlow";
import SetupGame from "./components/SetupGame";
import { useStreamingAPI } from "./hooks/useStreamingAPI";

export function App() {
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
      {renderScreen()}
    </div>
  );
}

export default App;