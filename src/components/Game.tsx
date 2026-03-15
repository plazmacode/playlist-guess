import { useState, useRef, useEffect } from "react";
import { type ProcessedSong } from "./SetupGame";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Check, ChevronsUpDown, Play, RotateCcw, Volume2 } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface GameProps {
  playlist: ProcessedSong[];
  allSongs: ProcessedSong[];
  onFinish: () => void;
}

export default function Game({ playlist, allSongs, onFinish }: GameProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [snippetStart, setSnippetStart] = useState(0);
  
  const [volume, setVolume] = useState(0.5);

  // Guessing State
  const [open, setOpen] = useState(false);
  const [guess, setGuess] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [score, setScore] = useState(0);

  const audioRef = useRef<HTMLAudioElement>(null);
  const currentSong = playlist[currentIndex];

  // Reset state when the song changes
  useEffect(() => {
    setGuess("");
    setHasSubmitted(false);
    setIsCorrect(false);
    setIsPlaying(false);
  }, [currentIndex]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Calculate the random 10s snippet once the audio metadata loads
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      const totalDuration = audioRef.current.duration;
      const minStart = totalDuration * 0.2; // 20% in
      const maxStart = totalDuration * 0.8 - 10; // 80% in, minus the 10s playtime

      let start = 0;
      // Safety check: if the song is really short, just start at the beginning
      if (maxStart > minStart) {
        start = Math.random() * (maxStart - minStart) + minStart;
      }
      setSnippetStart(start);
    }
  };

  const playSnippet = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = snippetStart;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    // Pause after 10 seconds if guess hasn't been submitted
    if (!hasSubmitted && audioRef.current && audioRef.current.currentTime >= snippetStart + 10) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };
  
  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleSubmit = () => {
    if (!guess) return;
    pauseAudio();
    setHasSubmitted(true);
    if (guess === currentSong.title) {
      setIsCorrect(true);
      setScore(s => s + 1);
    } else {
      setIsCorrect(false);
    }
  };

  const nextSong = () => {
    if (currentIndex < playlist.length - 1) {
      setCurrentIndex(c => c + 1);
    } else {
      onFinish();
    }
  };

  const handleSkip = () => {
    pauseAudio();
    setHasSubmitted(true);
    setIsCorrect(false);
    setGuess("");
  };

  return (
    <div className="flex flex-col items-center mt-12 px-80">
      <div className="flex justify-between w-full text-muted-foreground font-semibold mb-4">
        <span>Song {currentIndex + 1} of {playlist.length}</span>
        <span>Score: {score}</span>
      </div>

      <audio
        ref={audioRef}
        src={currentSong.previewUrl}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        controls={hasSubmitted} 
        className={`w-full my-4 ${hasSubmitted ? "block" : "hidden"}`}
      />

     {/* Custom Audio Controls (Only show BEFORE guessing) */}
      {!hasSubmitted && (
        <div className="flex flex-col w-full gap-4 items-center">
          <div className="flex gap-4">
            <Button 
              size="lg" 
              onClick={playSnippet} 
              disabled={isPlaying}
              className="w-48 text-lg"
            >
              <Play className="mr-2 h-5 w-5" /> 
              {isPlaying ? "Playing..." : "Play Snippet"}
            </Button>
            <Button size="lg" variant="outline" onClick={playSnippet} disabled={isPlaying}>
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>
          {/* Custom Volume Slider */}
          <div className="flex items-center gap-4 w-full max-w-[250px] mt-2">
            <Volume2 className="h-5 w-5 text-muted-foreground" />
            <Slider
              defaultValue={[0.5]}
              max={1}
              step={0.01}
              value={[volume]}
              onValueChange={(vals) => setVolume(vals[0])}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Guessing UI */}
      <div className="w-full flex flex-col gap-4 mt-8">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between h-12 text-lg"
              disabled={hasSubmitted}
            >
              {guess ? guess : "Search for your guess..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
            <Command>
              <CommandInput placeholder="Search songs..." />
              <CommandList>
                <CommandEmpty>No song found.</CommandEmpty>
                <CommandGroup>
                  {allSongs.map((song) => (
                    <CommandItem
                      key={song.id}
                      value={song.title}
                      onSelect={() => {
                        setGuess(song.title);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={`mr-2 h-4 w-4 ${
                          guess === song.title ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      {song.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Action Buttons Logic */}
        {!hasSubmitted ? (
          <div className="flex gap-4 w-full">
            <Button onClick={handleSubmit} disabled={!guess} className="flex-1 h-12 text-lg">
              Submit Guess
            </Button>
            <Button onClick={handleSkip} variant="secondary" className="w-24 h-12 text-lg">
              Skip
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full animate-in fade-in zoom-in duration-300">
            <div className={`text-2xl font-bold ${isCorrect ? "text-green-500" : "text-red-500"}`}>
              {isCorrect ? "Correct!" : "Skipped / Incorrect"}
            </div>
            
            {!isCorrect && (
              <p className="text-muted-foreground">The answer was: <span className="text-foreground font-semibold">{currentSong.title}</span></p>
            )}

            <Button onClick={nextSong} className="w-full h-12 text-lg mt-4">
              {currentIndex < playlist.length - 1 ? "Next Song" : "Finish Game"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}