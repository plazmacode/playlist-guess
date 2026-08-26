import { useState, useRef, type DragEvent, type ChangeEvent, useEffect } from "react";
import { Button } from "@/components/ui/button"
import type { ApiSong, FolderSplit } from "@/hooks/useStreamingAPI";
import { distributeEvenly } from "@/lib/game-utils";

export interface ProcessedSong {
  id: string;
  originalFile?: File;
  previewUrl: string;
  title: string;
}

interface SetupGameProps {
  onStart: (songs: ProcessedSong[], seed?: number, maxSongs?: number, apiSongs?: ProcessedSong[]) => void;
  status: boolean;
  fetchSongs: () => void;
  apiSongs: ApiSong[];
  getStreamUrl: (id: number) => string;
  folders: string[];
  fetchFolders: () => void;
  fetchPlaylist: (request: { totalCount: number; splits: FolderSplit[] }) => Promise<{ songs: ApiSong[]; warnings: string[] } | null>;
}


export function SetupGame({ onStart, status, fetchSongs, apiSongs, getStreamUrl, folders, fetchFolders, fetchPlaylist }: SetupGameProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedSongs, setUploadedSongs] = useState<ProcessedSong[]>([]);
  const [seedInput, setSeedInput] = useState("");

  const [mode, setMode] = useState<"quick" | "custom">("quick");
  const [totalCount, setTotalCount] = useState(10);
  const [splitPercentages, setSplitPercentages] = useState<Record<string, number>>({});
  const [isBuildingPlaylist, setIsBuildingPlaylist] = useState(false);
  const [playlistError, setPlaylistError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status) {
      fetchSongs();
      fetchFolders();
    }
  }, [status, fetchSongs, fetchFolders]);

  const splitSum = Object.values(splitPercentages).reduce((a, b) => a + b, 0);
  const selectedFolders = Object.keys(splitPercentages);
 
  const toggleFolder = (folder: string) => {
    setPlaylistError(null);
    setSplitPercentages((prev) => {
      const isSelected = folder in prev;
      const nextFolders = isSelected
        ? Object.keys(prev).filter((f) => f !== folder)
        : [...Object.keys(prev), folder];
      return distributeEvenly(nextFolders);
    });
  };
 
  const updatePercentage = (folder: string, value: number) => {
    setPlaylistError(null);
    setSplitPercentages((prev) => ({ ...prev, [folder]: value }));
  };
 
  const resolveSeed = async (): Promise<number> => {
    if (seedInput.trim() === "") {
      const generated = Math.floor(100000 + Math.random() * 900000);
      try {
        await navigator.clipboard.writeText(generated.toString());
      } catch (err) {
        console.error("Failed to copy seed to clipboard", err);
      }
      return generated;
    }
 
    const parsed = parseInt(seedInput, 10);
    return isNaN(parsed) ? Math.floor(100000 + Math.random() * 900000) : parsed;
  };


  const handleStartWithSeed = async () => {
    const convertedSongs: ProcessedSong[] = apiSongs.map((song) => ({
      id: song.id.toString(),
      title: song.title,
      previewUrl: getStreamUrl(song.id),
    }));

    let activeSeed: number;

    // Check if input is empty or invalid
    if (seedInput.trim() === "") {
      // Generates a random 6-digit number
      activeSeed = Math.floor(100000 + Math.random() * 900000);
      
      try {
        // copy to clipboard
        await navigator.clipboard.writeText(activeSeed.toString());
      } catch (err) {
        console.error("Failed to copy seed to clipboard", err);
      }
    } else {
      activeSeed = parseInt(seedInput, 10);
      
      // Fallback in case parsing fails
      if (isNaN(activeSeed)) {
        activeSeed = Math.floor(100000 + Math.random() * 900000);
      }
    }

    onStart(convertedSongs, activeSeed);
  };

  const handleStartCustomGame = async () => {
    setPlaylistError(null);
    
    const splits: FolderSplit[] = selectedFolders
      .map((folder) => ({ folder, percentage: splitPercentages[folder] }))
      .filter((s) => s.percentage > 0);
 
    if (splits.length === 0) {
      setPlaylistError("Pick at least one folder.");
      return;
    }
 
    if (Math.abs(splitSum - 100) > 0.5) {
      setPlaylistError(`Percentages must add up to 100 (currently ${splitSum}).`);
      return;
    }
 
    if (totalCount <= 0) {
      setPlaylistError("Song count must be greater than 0.");
      return;
    }
 
    setIsBuildingPlaylist(true);
    const result = await fetchPlaylist({ totalCount, splits });
    setIsBuildingPlaylist(false);
 
    if (!result) {
      setPlaylistError("Couldn't build a playlist from the server.");
      return;
    }
 
    const resultSongs: ProcessedSong[] = result.songs.map((song) => ({
      id: song.id.toString(),
      title: song.title,
      previewUrl: getStreamUrl(song.id),
    }));
 
    const activeSeed = await resolveSeed();
    
    const allSongs: ProcessedSong[] = apiSongs.map((song) => ({
      id: song.id.toString(),
      title: song.title,
      previewUrl: getStreamUrl(song.id),
    }));

    onStart(resultSongs, activeSeed, resultSongs.length, allSongs);
  };


  // --- Drag and Drop Handlers ---
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Required to allow dropping
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  // --- Click to Upload Handler ---
  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const handleBoxClick = () => {
    fileInputRef.current?.click();
  };

  const processFiles = (files: File[]) => {
    const audioFiles = files.filter(file => file.type.startsWith('audio/'));

    const newSongs: ProcessedSong[] = audioFiles.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      
      const cleanTitle = file.name.replace(/\.[^/.]+$/, "");

      return {
        id: crypto.randomUUID(), // Generate a unique ID
        originalFile: file,
        previewUrl: previewUrl,
        title: cleanTitle,
      };
    });

    setUploadedSongs((prev) => [...prev, ...newSongs]);
  };

    const renderModeToggle = () => (
    <div className="flex gap-2 mb-4">
      <button
        onClick={() => setMode("quick")}
        className={`px-4 py-2 rounded-md transition-colors ${
          mode === "quick" ? "bg-pink-600 text-white" : "bg-secondary/40 text-muted-foreground"
        }`}
      >
        Quick Random
      </button>
      <button
        onClick={() => setMode("custom")}
        className={`px-4 py-2 rounded-md transition-colors ${
          mode === "custom" ? "bg-pink-600 text-white" : "bg-secondary/40 text-muted-foreground"
        }`}
      >
        Custom Split
      </button>
    </div>
  );
 
  const renderSeedInput = () => (
    <div className="flex flex-col items-center bg-secondary/20 p-4 rounded-xl border border-border w-64">
      <label className="text-sm mb-2 text-muted-foreground w-full text-center">
        Have a seed? Enter it here:
      </label>
      <input
        type="number"
        placeholder="Leave empty for random..."
        value={seedInput}
        onChange={(e) => setSeedInput(e.target.value)}
        className="mb-3 px-3 py-2 rounded bg-background border border-input text-foreground w-full"
      />
    </div>
  );
 
  const renderQuickMode = () => (
    <div className="flex flex-col items-center gap-3">
      {renderSeedInput()}
      <button
        onClick={handleStartWithSeed}
        className="bg-pink-600 px-8 py-3 hover:bg-pink-800 transition-colors w-64 rounded-md text-white flex items-center justify-center gap-2"
      >
        Start Game and copy seed
      </button>
    </div>
  );
 
  const renderCustomMode = () => (
    <div className="flex flex-col items-center gap-4 w-full">
      {folders.length === 0 ? (
        <p className="text-sm text-muted-foreground">No folders found on the server.</p>
      ) : (
        <div className="bg-secondary/20 p-4 rounded-xl border border-border w-full max-w-md">
          <p className="text-sm mb-3 text-muted-foreground">Pick folders to pull songs from:</p>
          <div className="space-y-3">
            {folders.map((folder) => {
              const isSelected = folder in splitPercentages;
              return (
                <div key={folder} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleFolder(folder)}
                    className="w-4 h-4"
                  />
                  <span className="flex-1 truncate">{folder}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={!isSelected}
                    value={isSelected ? splitPercentages[folder] : 0}
                    onChange={(e) => updatePercentage(folder, Number(e.target.value))}
                    className="w-20 px-2 py-1 rounded bg-background border border-input text-foreground text-right disabled:opacity-40"
                  />
                  <span className="text-sm text-muted-foreground w-4">%</span>
                </div>
              );
            })}
          </div>
          <div className={`text-sm mt-3 text-right ${Math.abs(splitSum - 100) > 0.5 ? "text-red-400" : "text-green-400"}`}>
            Total: {splitSum}%
          </div>
        </div>
      )}
 
      <div className="flex items-center gap-3">
        <label className="text-sm text-muted-foreground">Number of songs:</label>
        <input
          type="number"
          min={1}
          value={totalCount}
          onChange={(e) => setTotalCount(Number(e.target.value))}
          className="w-20 px-2 py-1 rounded bg-background border border-input text-foreground"
        />
      </div>
 
      {renderSeedInput()}
 
      {playlistError && <p className="text-sm text-red-400">{playlistError}</p>}
 
      <button
        onClick={handleStartCustomGame}
        disabled={isBuildingPlaylist}
        className="bg-pink-600 px-8 py-3 hover:bg-pink-800 transition-colors w-64 rounded-md text-white flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isBuildingPlaylist ? "Building playlist..." : "Start Game and copy seed"}
      </button>
    </div>
  );

  
  // If the backend service is running we want to render a button to only use the songs from there.
  const renderStreamingMode = () => {
    if (apiSongs.length > 0) {
      return (
        <div>
          <div className="flex flex-col items-center">
            <p className="text-xl mb-4">Streaming available!!!</p>
            {renderModeToggle()}
            {mode === "quick" ? renderQuickMode() : renderCustomMode()}
          </div>
          <hr />
        </div>
      )
    } else {
      return <p className="text-4xl">no streaming service on :(</p>
    }
  }



  return (
    <div>
      {renderStreamingMode()}
      <div className="flex justify-center items-center">
        <h1 className="text-2xl mt-12 mb-4">Upload some songs :3</h1>
      </div>
      <div
      onClick={handleBoxClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
          h-[30vh] m-4 border-dashed border-5 rounded-xl flex flex-col justify-center items-center cursor-pointer transition-colors duration-200
          ${isDragging 
            ? "border-blue-500 bg-blue-50/10" // Visual feedback when dragging
            : "border-gray-300 hover:bg-gray-50/5 hover:border-gray-400"
          }
        `}
      >
        <p className="text-2xl text-gray-500">
          {isDragging ? "Drop songs here!" : "Drag and drop your songs here"}
        </p>
        <p className="text-sm text-gray-400 mt-2">or click to select files</p>
        {/*Hidden file input*/}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileInput}
          className="hidden"
          multiple
          accept="audio/*"
        />
      </div>
      <div className="flex justify-center items-center">
        {uploadedSongs.length > 0 && (
          <Button className="mt-4" onClick={() => onStart(uploadedSongs)}>
            Start Game
          </Button>
        )}
      </div>
    


      {uploadedSongs.length > 0 && (
        <div className="ml-4 mt-8">
          <h2 className="text-xl font-bold mb-4">Ready to play: {uploadedSongs.length} songs</h2>
          <ul className="space-y-2">
            {uploadedSongs.map((song) => (
              <li key={song.id} className="p-3 border rounded bg-secondary/40">
                {song.title}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SetupGame;