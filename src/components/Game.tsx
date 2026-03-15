import { useState, useRef, useEffect } from "react";
import { type ProcessedSong } from "./SetupGame";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Check, ChevronsUpDown, Play, Volume2, FastForward } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const INTERVALS = [0.5, 1, 2, 5, 10]; 

export interface GameResult {
  song: ProcessedSong;
  guessedCorrectly: boolean;
  attemptsUsed: number;
  userGuess: string | null;
}

interface GameProps {
  playlist: ProcessedSong[];
  allSongs: ProcessedSong[];
  onFinish: (results: GameResult[]) => void;
}

export default function Game({ playlist, allSongs, onFinish }: GameProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [snippetStart, setSnippetStart] = useState(0);
  const [volume, setVolume] = useState(0.5);

  const [attemptStep, setAttemptStep] = useState(0); 
  const currentAllowedTime = INTERVALS[attemptStep];
  const maxAttempts = INTERVALS.length;

  // Guessing State
  const [open, setOpen] = useState(false);
  const [guess, setGuess] = useState("");
  const [hasResolved, setHasResolved] = useState(false); // True when song is beaten or failed
  const [isCorrect, setIsCorrect] = useState(false);
  const [results, setResults] = useState<GameResult[]>([]);

  const audioRef = useRef<HTMLAudioElement>(null);
  const currentSong = playlist[currentIndex];

  // Reset state for new song
  useEffect(() => {
    setGuess("");
    setHasResolved(false);
    setIsCorrect(false);
    setIsPlaying(false);
    setAttemptStep(0);
  }, [currentIndex]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      const totalDuration = audioRef.current.duration;
      const minStart = totalDuration * 0.2;  // 20% in to skip intro's (some genre's especially have less distinguishable intros)
      
      // Calculate max start based on the MAXIMUM interval (10s) so we never run out of song
      const maxStart = totalDuration * 0.8 - INTERVALS[INTERVALS.length - 1]; 

      let start = 0;
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
    // Pause the audio if it goes at current interval.
    // Only for when it hasn't been resolved yet
    if (!hasResolved && audioRef.current && audioRef.current.currentTime >= snippetStart + currentAllowedTime) {
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

  const resolveSong = (correct: boolean, finalGuess: string | null) => {
    pauseAudio();
    setHasResolved(true);
    setIsCorrect(correct);
    
    // Save the result
    setResults(prev => [
      ...prev, 
      {
        song: currentSong,
        guessedCorrectly: correct,
        attemptsUsed: attemptStep + 1,
        userGuess: finalGuess
      }
    ]);
  };

  const handleSubmit = () => {
    if (!guess) return;
    
    if (guess === currentSong.title) {
      resolveSong(true, guess);
    } else {
      // Wrong guess!
      if (attemptStep < maxAttempts - 1) {
        setAttemptStep(prev => prev + 1);
        setGuess(""); // Clear input for next try
      } else {
        // Out of attempts
        resolveSong(false, guess);
      }
    }
  };

  const handleSkip = () => {
    if (attemptStep < maxAttempts - 1) {
      setAttemptStep(prev => prev + 1);
      setGuess("");
    } else {
      resolveSong(false, "Skipped");
    }
  };

  const nextSong = () => {
    if (currentIndex < playlist.length - 1) {
      setCurrentIndex(c => c + 1);
    } else {
      onFinish(results);
    }
  };

  return (
    <div className="flex flex-col items-center mt-12 px-80">
      {/* Header */}
      <div className="flex justify-between w-full font-semibold mb-4">
        <span>Song {currentIndex + 1} of {playlist.length}</span>
        <span>
          Attempt {hasResolved ? attemptStep + 1 : attemptStep + 1} of {maxAttempts}
        </span>
      </div>

      {/* Interval Progress Bar Visualization */}
      <div className="w-full flex h-3 bg-secondary rounded-full mb-8 gap-1">
        {INTERVALS.map((time, idx) => (
          <div 
            key={idx} 
            className={`h-full transition-colors duration-300 ${
              idx <= attemptStep 
                ? (hasResolved && isCorrect && idx === attemptStep) ? "bg-green-500" : "bg-primary" 
                : "bg-secondary-foreground/20"
            }`}
            style={{ width: `${(time / INTERVALS[INTERVALS.length - 1]) * 100}%` }}
          />
        ))}
      </div>

      <audio
        ref={audioRef}
        src={currentSong.previewUrl}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        controls={hasResolved} 
        className={`w-full my-4 ${hasResolved ? "block" : "hidden"}`}
      />

      {/* Custom Audio Controls (Only show BEFORE guessing is resolved) */}
      {!hasResolved && (
        <div className="flex flex-col w-full gap-4 items-center">
          <div className="text-xl font-bold mb-2">
            Playing {currentAllowedTime}s snippet
          </div>
          <div className="flex gap-4">
            <Button size="lg" onClick={playSnippet} disabled={isPlaying} className="w-48 h-14 text-lg">
              <Play className="mr-2 h-5 w-5" /> 
              {isPlaying ? "Playing..." : "Play"}
            </Button>
          </div>
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
              disabled={hasResolved}
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
                      <Check className={`mr-2 h-4 w-4 ${guess === song.title ? "opacity-100" : "opacity-0"}`} />
                      {song.title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Action Buttons Logic */}
        {!hasResolved ? (
          <div className="flex gap-4 w-full">
            <Button onClick={handleSubmit} disabled={!guess} className="flex-1 h-12 text-lg">
              Submit Guess
            </Button>
            <Button onClick={handleSkip} variant="secondary" className="w-32 h-12 text-lg">
              {attemptStep < maxAttempts - 1 ? "Skip (+Time)" : "Give Up"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 w-full animate-in fade-in zoom-in duration-300">
            <div className={`text-2xl font-bold ${isCorrect ? "text-green-500" : "text-red-500"}`}>
              {isCorrect ? `Correct in ${attemptStep + 1} attempts!` : "Out of attempts!"}
            </div>
            
            {!isCorrect && (
              <p className="text-muted-foreground">The answer was: <span className="text-foreground font-semibold">{currentSong.title}</span></p>
            )}

            <Button onClick={nextSong} className="w-full h-12 text-lg mt-4">
              {currentIndex < playlist.length - 1 ? "Next Song" : "See Results"}
              <FastForward className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}