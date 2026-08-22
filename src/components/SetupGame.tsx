import { useState, useRef, type DragEvent, type ChangeEvent, useEffect } from "react";
import { Button } from "@/components/ui/button"
import type { ApiSong } from "@/hooks/useStreamingAPI";

export interface ProcessedSong {
  id: string;
  originalFile?: File;
  previewUrl: string;
  title: string;
}

interface SetupGameProps {
  onStart: (songs: ProcessedSong[], seed?: number) => void;
  status: boolean;
  fetchSongs: () => void;
  apiSongs: ApiSong[];
  getStreamUrl: (id: number) => string;
}

export function SetupGame({ onStart, status, fetchSongs, apiSongs, getStreamUrl }: SetupGameProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedSongs, setUploadedSongs] = useState<ProcessedSong[]>([]);
  const [seedInput, setSeedInput] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status) {
      fetchSongs();
    }
  }, [status, fetchSongs]);

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
  
  // If the backend service is running we want to render a button to only use the songs from there.
  const renderStreamingMode = () => {
    if(apiSongs.length > 0) {
      return (
        <div>
          <div className="flex flex-col items-center">
            <p className="text-xl">Streaming available!!!</p>
            {/* Seed Input and Button Area */}
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
              <button onClick={handleStartWithSeed} className="bg-pink-600 px-8 py-3 hover:bg-pink-800 transition-colors w-full rounded-md text-white flex items-center justify-center gap-2">
                Start Game and copy seed
              </button>
            </div>
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