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
  guessHistory: Array<'correct' | 'artist' | 'wrong' | 'skipped'>;
  firstAttemptThinkingTimeMs?: number;
}

interface GameProps {
  playlist: ProcessedSong[];
  allSongs: ProcessedSong[];
  onFinish: (results: GameResult[]) => void;
}

// Helper function to extract main artists and remixers from our file names
const extractArtists = (title: string): string[] => {
  const parts = title.split('-');
  const artists: string[] = [];

  // Main artist is usually everything before the first hyphen
  if (parts.length > 0) {
    artists.push(parts[0].trim().toLowerCase());
  }

  // Check for remixers in parentheses or brackets in the rest of the title
  if (parts.length > 1) {
    const restOfTitle = parts.slice(1).join('-');
    const remixMatch = restOfTitle.match(/\(([^)]+)\)|\[([^\]]+)\]/g);

    if (remixMatch) {
      remixMatch.forEach(match => {
        let inside = match.replace(/[()\[\]]/g, '').toLowerCase();
        // Strip common remix terminology to isolate the actual artist name
        const keywords = ['remix', 'bootleg', 'refix', 'edit', 'flip', 'mashup', 'mix', 'by', 'vip'];
        keywords.forEach(kw => {
          inside = inside.replace(new RegExp(`\\b${kw}\\b`, 'gi'), '');
        });
        inside = inside.trim();
        if (inside) artists.push(inside);
      });
    }
  }
  return artists;
};

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
  const [isReady, setIsReady] = useState(false); 
  const [results, setResults] = useState<GameResult[]>([]);

  // Advanced Tracking
  const [guessHistory, setGuessHistory] = useState<Array<'correct' | 'artist' | 'wrong' | 'skipped'>>([]);
  const [pastGuesses, setPastGuesses] = useState<Record<string, 'artist' | 'wrong'>>({});

  // Web Audio API Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Native Audio Ref
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const playbackEndedAtRef = useRef<number | null>(null); 
  const firstAttemptThinkingTimeRef = useRef<number | null>(null);

  const currentSong = playlist[currentIndex];

  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioCtxRef.current && AudioContextClass) {
      audioCtxRef.current = new AudioContextClass();
    }
  }, []);

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
    setGuessHistory([]); // Reset history
    setPastGuesses({});  // Reset dropdown colors

    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch(e) {}
      sourceNodeRef.current.disconnect();
    }

    const loadAndDecodeAudio = async () => {
      if (!audioCtxRef.current) return;

      try {
        const arrayBuffer = await currentSong.originalFile.arrayBuffer();
        const decodedData = await audioCtxRef.current.decodeAudioData(arrayBuffer);

        if (isCancelled) return;
        audioBufferRef.current = decodedData;

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
    return () => { isCancelled = true; };
  }, [currentIndex, currentSong]);

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

  const playSnippet = () => {
    if (!audioCtxRef.current || !audioBufferRef.current) return;

    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch(e) {}
      sourceNodeRef.current.disconnect();
    }

    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    const source = audioCtxRef.current.createBufferSource();
    source.buffer = audioBufferRef.current;

    const gainNode = audioCtxRef.current.createGain();
    gainNode.gain.value = volume;
    gainNodeRef.current = gainNode;

    source.connect(gainNode);
    gainNode.connect(audioCtxRef.current.destination);

    source.start(0, snippetStart, currentAllowedTime);
    
    sourceNodeRef.current = source;
    setIsPlaying(true);

    source.onended = () => {
      setIsPlaying(false);

      // Start timer for scoring system
      if (attemptStep === 0) playbackEndedAtRef.current = Date.now();
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

  const resolveSong = (correct: boolean, finalGuess: string | null, finalHistory: Array<'correct' | 'artist' | 'wrong' | 'skipped'>) => {
    pauseAudio();
    setHasResolved(true);
    setIsCorrect(correct);

    if (audioRef.current) {
      audioRef.current.currentTime = snippetStart;
    }
    
    setResults(prev => [
      ...prev, 
      {
        song: currentSong,
        guessedCorrectly: correct,
        attemptsUsed: attemptStep + 1,
        userGuess: finalGuess,
        guessHistory: finalHistory,
        firstAttemptThinkingTimeMs: firstAttemptThinkingTimeRef.current || 0,
      }
    ]);
  };

  const handleSubmit = () => {
    if (!guess) return;
    
    if (attemptStep === 0 && playbackEndedAtRef.current) {
      // Calculate how long they thought about it after the music stopped
      firstAttemptThinkingTimeRef.current = Date.now() - playbackEndedAtRef.current;
    }

    const isExactMatch = guess === currentSong.title;
    
    // Evaluate for partial points (Artist match)
    const guessArtists = extractArtists(guess);
    const targetArtists = extractArtists(currentSong.title);
    const isPartialArtistMatch = !isExactMatch && guessArtists.some(artist => targetArtists.includes(artist));

    const guessResultType = isExactMatch ? 'correct' : (isPartialArtistMatch ? 'artist' : 'wrong');
    const newHistory = [...guessHistory, guessResultType];
    
    if (isExactMatch) {
      setGuessHistory(newHistory);
      resolveSong(true, guess, newHistory);
    } else {
      // Record wrong/artist guess to highlight in dropdown
      setPastGuesses(prev => ({ ...prev, [guess]: guessResultType as 'artist' | 'wrong' }));
      setGuessHistory(newHistory);

      if (attemptStep < maxAttempts - 1) {
        setAttemptStep(prev => prev + 1);
        setGuess("");
        setSearchQuery("");
      } else {
        resolveSong(false, guess, newHistory);
      }
    }
  };

  const handleSkip = () => {
    const newHistory: Array<'correct' | 'artist' | 'wrong' | 'skipped'> = [...guessHistory, 'skipped'];
    setGuessHistory(newHistory);

    if (attemptStep < maxAttempts - 1) {
      setAttemptStep(prev => prev + 1);
      setGuess("");
      setSearchQuery("");
    } else {
      resolveSong(false, "Skipped", newHistory);
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
    <div className="flex flex-col items-center mt-12 px-80 w-full">
      <div className="flex justify-between w-full font-semibold mb-4">
        <span>Song {currentIndex + 1} of {playlist.length}</span>
        <span>Attempt {hasResolved ? attemptStep + 1 : attemptStep + 1} of {maxAttempts}</span>
      </div>

      <div className="w-full flex h-3 bg-secondary rounded-full mb-8 gap-1">
        {INTERVALS.map((time, idx) => {
          let bgColor = "bg-secondary-foreground/20"; // Default unused state
          
          if (idx < guessHistory.length) {
            // Apply color based on the history of this exact attempt segment
            const status = guessHistory[idx];
            if (status === 'correct') bgColor = "bg-green-500";
            else if (status === 'artist') bgColor = "bg-yellow-500";
            else bgColor = "bg-red-500"; // Covers 'wrong' and 'skipped'
          } else if (idx === attemptStep && !hasResolved) {
            // Highlight the current attempt segment
            bgColor = "bg-primary";
          }

          return (
            <div 
              key={idx} 
              className={`h-full transition-colors duration-300 ${bgColor}`}
              style={{ width: `${(time / INTERVALS[INTERVALS.length - 1]) * 100}%` }}
            />
          );
        })}
      </div>

      <audio
        ref={audioRef}
        src={currentSong.previewUrl}
        controls={hasResolved} 
        className={`w-full my-4 ${hasResolved ? "block" : "hidden"}`}
      />

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
              <span className="truncate">{guess ? guess : "Search for your guess..."}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
            <Command shouldFilter={false}>
              <CommandInput 
                placeholder="Search songs..." 
                value={searchQuery}
                onValueChange={setSearchQuery} 
              />
              <CommandList>
                <CommandEmpty>No song found.</CommandEmpty>
                <CommandGroup>
                  {visibleSongs.map((song) => {
                    const guessStatus = pastGuesses[song.title];
                    return (
                      <CommandItem
                        key={song.id}
                        value={song.title}
                        onSelect={() => {
                          setGuess(song.title);
                          setOpen(false);
                        }}
                        className={`
                          ${guessStatus === 'wrong' ? 'text-red-500' : ''}
                          ${guessStatus === 'artist' ? 'text-yellow-600 dark:text-yellow-500' : ''}
                        `}
                      >
                        <Check className={`mr-2 h-4 w-4 shrink-0 ${guess === song.title ? "opacity-100" : "opacity-0"}`} />
                        <span className="truncate">{song.title}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {!hasResolved ? (
          <div className="flex gap-4 w-full">
            <Button onClick={handleSubmit} disabled={!guess} className="flex-1 h-12 text-lg bg-purple-800 text-white hover:bg-purple-900">
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
              <p className="text-muted-foreground text-center">
                The answer was: <br/><span className="text-foreground font-semibold text-lg">{currentSong.title}</span>
              </p>
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