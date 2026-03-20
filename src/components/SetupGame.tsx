import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button"

export interface ProcessedSong {
  id: string;
  originalFile: File;
  previewUrl: string;
  title: string;
}

interface SetupGameProps {
  onStart: (songs: ProcessedSong[]) => void;
}

export function SetupGame({ onStart }: SetupGameProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedSongs, setUploadedSongs] = useState<ProcessedSong[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    // Filter to make sure they only uploaded audio files
    const audioFiles = files.filter(file => file.type.startsWith('audio/'));

    const newSongs: ProcessedSong[] = audioFiles.map((file) => {
      // 1. Create a temporary local URL that the <audio> tag can read
      const previewUrl = URL.createObjectURL(file);
      
      // 2. Clean up the filename to use as the answer 
      // (e.g., "The Weeknd - Blinding Lights.mp3" -> "The Weeknd - Blinding Lights")
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

  return (
    <div>
      <div className="flex justify-center items-center">
        <h1 className="text-4xl mt-12 mb-4">Upload some songs</h1>
      </div>
      <div
      onClick={handleBoxClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
          h-[40vh] m-4 p-4 border-dashed border-2 rounded-xl flex flex-col justify-center items-center cursor-pointer transition-colors duration-200
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
        <div className="ml-4 mt-8 max-w-2xl">
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