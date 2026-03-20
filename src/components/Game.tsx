import { useState, useRef, useEffect, useMemo } from "react";
import { type ProcessedSong } from "./SetupGame";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Check, ChevronsUpDown, Play, Volume2, FastForward, Loader2 } from "lucide-react";
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

  // Guessing & Loading State
  const [open, setOpen] = useState(false);
  const [guess, setGuess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [hasResolved, setHasResolved] = useState(false); 
  const [isCorrect, setIsCorrect] = useState(false);
  const [isReady, setIsReady] = useState(false); // Tracks if Web Audio API has decoded the track
  const [results, setResults] = useState<GameResult[]>([]);

  // Web Audio API Refs (The Engine)
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Native Audio Ref (Used ONLY for the full song player at the end)
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const currentSong = playlist[currentIndex];

  // 1. Initialize Audio Context on mount
  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioCtxRef.current && AudioContextClass) {
      audioCtxRef.current = new AudioContextClass();
    }
  }, []);

  // 2. Decode the local MP3 file into memory when the song changes
  useEffect(() => {
    let isCancelled = false;
    setIsReady(false);
    setSnippetStart(0);
    setGuess("");
    setSearchQuery(""); 
    setHasResolved(false);
    setIsCorrect(false);
    setIsPlaying(false);
    setAttemptStep(0);

    // Stop current Web Audio playback if switching songs
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch(e) {}
      sourceNodeRef.current.disconnect();
    }

    const loadAndDecodeAudio = async () => {
      if (!audioCtxRef.current) return;

      try {
        // Read the raw file data
        const arrayBuffer = await currentSong.originalFile.arrayBuffer();
        // Decode it instantly into PCM memory (fixes all VBR/silence bugs)
        const decodedData = await audioCtxRef.current.decodeAudioData(arrayBuffer);

        if (isCancelled) return;

        audioBufferRef.current = decodedData;

        // Calculate a safe 20%-80% start window
        const totalDuration = decodedData.duration;
        const minStart = totalDuration * 0.2; 
        const maxStart = totalDuration * 0.8 - INTERVALS[INTERVALS.length - 1]; 

        let start = 0;
        if (maxStart > minStart) {
          start = Math.random() * (maxStart - minStart) + minStart;
        }

        setSnippetStart(start);
        setIsReady(true);
      } catch (error) {
        console.error("Failed to decode audio:", error);
      }
    };

    loadAndDecodeAudio();

    return () => {
      isCancelled = true;
    };
  }, [currentIndex, currentSong]);

  // Sync Volume
  useEffect(() => {
    if (gainNodeRef.current) gainNodeRef.current.gain.value = volume;
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const visibleSongs = useMemo(() => {
    if (!searchQuery) return allSongs.slice(0, 50); 
    const lowerQuery = searchQuery.toLowerCase();
    return allSongs
      .filter((song) => song.title.toLowerCase().includes(lowerQuery))
      .slice(0, 50); 
  }, [allSongs, searchQuery]);

  // --- THE NEW MILLISECOND-ACCURATE PLAYER ---
  const playSnippet = () => {
    if (!audioCtxRef.current || !audioBufferRef.current) return;

    // Stop any existing overlapping sounds
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch(e) {}
      sourceNodeRef.current.disconnect();
    }

    // Wake up the audio context if the browser suspended it
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    // Create a new sound source from our decoded memory
    const source = audioCtxRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;

    // Apply the volume
    const gainNode = audioCtxRef.current.createGain();
    gainNode.gain.value = volume;
    gainNodeRef.current = gainNode;

    source.connect(gainNode);
    gainNode.connect(audioCtxRef.current.destination);

    // .start(whenToStart, offsetInSong, durationToPlay)
    source.start(0, snippetStart, currentAllowedTime);
    
    sourceNodeRef.current = source;
    setIsPlaying(true);

    // Let the API turn the button off exactly when the snippet finishes
    source.onended = () => {
      setIsPlaying(false);
    };
  };

  const pauseAudio = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch(e) {}
      setIsPlaying(false);
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  const resolveSong = (correct: boolean, finalGuess: string | null) => {
    pauseAudio();
    setHasResolved(true);
    setIsCorrect(correct);

    // Seek the native audio player to the start of the snippet for easy comparison
    if (audioRef.current) {
      audioRef.current.currentTime = snippetStart;
    }
    
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
      if (attemptStep < maxAttempts - 1) {
        setAttemptStep(prev => prev + 1);
        setGuess("");
        setSearchQuery("");
      } else {
        resolveSong(false, guess);
      }
    }
  };

  const handleSkip = () => {
    if (attemptStep < maxAttempts - 1) {
      setAttemptStep(prev => prev + 1);
      setGuess("");
      setSearchQuery("");
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
      <div className="flex justify-between w-full font-semibold mb-4">
        <span>Song {currentIndex + 1} of {playlist.length}</span>
        <span>Attempt {hasResolved ? attemptStep + 1 : attemptStep + 1} of {maxAttempts}</span>
      </div>

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

      {/* The Native Audio Tag: Now ONLY used to play the full song after guessing */}
      <audio
        ref={audioRef}
        src={currentSong.previewUrl}
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
            <Button size="lg" onClick={playSnippet} disabled={isPlaying || !isReady} className="w-48 h-14 text-lg">
              {!isReady ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Decoding...
                </>
              ) : isPlaying ? (
                "Playing..."
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" /> 
                  Play
                </>
              )}
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
            <Command shouldFilter={false}>
              <CommandInput 
                placeholder="Search songs..." 
                value={searchQuery}
                onValueChange={setSearchQuery} // Bind search query state
              />
              <CommandList>
                <CommandEmpty>No song found.</CommandEmpty>
                <CommandGroup>
                  {visibleSongs.map((song) => (
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

        {!hasResolved ? (
          <div className="flex gap-4 w-full">
            <Button onClick={handleSubmit} disabled={!guess} className="flex-1 h-12 text-lg bg-purple-800 text-white">
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