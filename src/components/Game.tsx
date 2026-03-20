import { useState, useRef, useMemo, useEffect } from "react";
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

import { INTERVALS, calculatePoints, extractArtists, formatTime, type GameResult } from "@/lib/game-utils";
import { useWebAudio } from "@/hooks/useWebAudio";

interface GameProps {
  playlist: ProcessedSong[];
  allSongs: ProcessedSong[];
  onFinish: (results: GameResult[]) => void;
}

export default function Game({ playlist, allSongs, onFinish }: GameProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [volume, setVolume] = useState(0.5);

  // Tracks which time interval the user is currently on (0 = 0.5s, 1 = 1s, etc.)
  const [attemptStep, setAttemptStep] = useState(0); 
  const currentAllowedTime = INTERVALS[attemptStep];
  const maxAttempts = INTERVALS.length;

  // UI State: Controls whether the Shadcn Popover (the song suggestions dropdown) is visible
  const [open, setOpen] = useState(false);
  const [guess, setGuess] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Game Logic State
  const [hasResolved, setHasResolved] = useState(false); 
  const [isCorrect, setIsCorrect] = useState(false);
  const [results, setResults] = useState<GameResult[]>([]);

  // guessHistory tracks the status of each attempt in the current round to color-code the top progress bar.
  const [guessHistory, setGuessHistory] = useState<Array<'correct' | 'artist' | 'wrong' | 'skipped'>>([]);

  // pastGuesses caches incorrect/partial guesses for the current song.
  // We use this to highlight bad guesses in red/yellow inside the dropdown so users don't repeat mistakes.
  const [pastGuesses, setPastGuesses] = useState<Record<string, 'artist' | 'wrong'>>({});

  // Records the exact time the user spent thinking after the first audio snippet ended.
  // This is strictly used to calculate the < 5 seconds "speed bonus" in the scoring engine.
  const firstAttemptThinkingTimeRef = useRef<number | null>(null);

  // Tracks the exact millisecond the song was successfully decoded and presented to the user
  const songStartTimeRef = useRef<number | null>(null);

  const currentSong = playlist[currentIndex];

  // We use a custom Web Audio API hook here instead of standard HTML5 <audio> tags for the guessing phase.
  // Standard <audio> tags struggle to seek accurately within compressed VBR MP3s, often resulting in several seconds of silent playback.
  // The Web Audio API decodes the whole file into RAM upfront, allowing millisecond-perfect slices for our short intervals.
  const { 
    isReady, 
    isPlaying, 
    snippetStart, 
    playSnippet, 
    pauseAudio, 
    audioRef, 
    playbackEndedAtRef,
    resetPlayer
  } = useWebAudio(currentSong, currentAllowedTime, volume, attemptStep, INTERVALS[INTERVALS.length - 1]);

  // Start the master timer for this song as soon as the Web Audio API finishes decoding it
  useEffect(() => {
    if (isReady && !songStartTimeRef.current) {
      songStartTimeRef.current = Date.now();
    }
  }, [isReady]);

  // We manually filter and slice the songs here instead of letting Shadcn's <Command> component do it.
  // Shadcn's underlying `cmdk` library renders ALL items to the DOM and just hides non-matches with CSS.
  // Rendering 1,000+ DOM nodes instantly freezes the browser, so we enforce a strict 50-item limit in memory.
  const visibleSongs = useMemo(() => {
    if (!searchQuery) return allSongs.slice(0, 50); 
    const searchTerms = searchQuery.toLowerCase().trim().split(/\s+/);
    return allSongs
      .filter((song) => {
        const lowerTitle = song.title.toLowerCase();
        // Require EVERY word the user typed to exist somewhere in the title (ignores exact ordering/hyphens)
        return searchTerms.every(term => lowerTitle.includes(term));
      })
      .slice(0, 50); 
  }, [allSongs, searchQuery]);

  const resolveSong = (correct: boolean, finalGuess: string | null, finalHistory: Array<'correct' | 'artist' | 'wrong' | 'skipped'>) => {
    pauseAudio();
    setHasResolved(true);
    setIsCorrect(correct);

    // Calculate total time taken from the moment it loaded to the moment they finally submitted/skipped
    const totalTimeMs = songStartTimeRef.current ? Date.now() - songStartTimeRef.current : 0;

    // Sync the native <audio> player (revealed after guessing) to start exactly where the random snippet started, making it easy for the user to compare.
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
        totalTimeMs: totalTimeMs
      }
    ]);
  };

  const handleSubmit = () => {
    if (!guess) return;
    
    // If this is their first attempt, calculate their exact thinking time for the speed bonus.
    // We only trigger this if playbackEndedAtRef is populated (meaning they actually listened to the clip).
    if (attemptStep === 0 && playbackEndedAtRef.current && !firstAttemptThinkingTimeRef.current) {
      firstAttemptThinkingTimeRef.current = Date.now() - playbackEndedAtRef.current;
    }

    const isExactMatch = guess === currentSong.title;
    const guessArtists = extractArtists(guess);
    const targetArtists = extractArtists(currentSong.title);

    // Award partial credit if the exact song is wrong, but they correctly identified at least one artist
    const isPartialArtistMatch = !isExactMatch && guessArtists.some(artist => targetArtists.includes(artist));

    const guessResultType: 'correct' | 'artist' | 'wrong' = isExactMatch ? 'correct' : (isPartialArtistMatch ? 'artist' : 'wrong');
    const newHistory = [...guessHistory, guessResultType];
    
    if (isExactMatch) {
      setGuessHistory(newHistory);
      resolveSong(true, guess, newHistory);
    } else {
      // Cache the bad guess so we can visually warn them if they look at it in the dropdown again
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
      setGuess("");
      setSearchQuery(""); 
      setHasResolved(false);
      setIsCorrect(false);
      setAttemptStep(0);
      setGuessHistory([]); 
      setPastGuesses({});  
      firstAttemptThinkingTimeRef.current = null;
      songStartTimeRef.current = null;

      resetPlayer();
      
      setCurrentIndex(c => c + 1);
    } else {
      onFinish(results);
    }
  };
  const currentResult = results[currentIndex];
  const earnedPoints = currentResult ? calculatePoints(currentResult) : 0;
  const currentTotalScore = results.reduce((sum, res) => sum + calculatePoints(res), 0);

  return (
    <div className="flex flex-col items-center mt-12 px-80 w-full">
      <div className="flex justify-between w-full font-semibold mb-4">
        <span>Song {currentIndex + 1} of {playlist.length}</span>
        <span>Attempt {hasResolved ? attemptStep + 1 : attemptStep + 1} of {maxAttempts}</span>
      </div>

      <div className="w-full flex h-3 bg-secondary rounded-full mb-8 gap-1">
        {INTERVALS.map((time, idx) => {
          let bgColor = "bg-secondary-foreground/20"; 
          
          if (idx < guessHistory.length) {
            const status = guessHistory[idx];
            if (status === 'correct') bgColor = "bg-green-500";
            else if (status === 'artist') bgColor = "bg-yellow-500";
            else bgColor = "bg-red-500"; 
          } else if (idx === attemptStep && !hasResolved) {
            bgColor = "bg-primary"; // Highlight the current active segment
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
                          setOpen(false); // Close the dropdown when a song is selected
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

            <div className="flex items-center gap-8 mt-4 mb-2 bg-secondary/30 px-8 py-4 rounded-xl">
              <div className="flex flex-col items-center">
                <span className="text-sm text-muted-foreground uppercase font-semibold">Gained</span>
                <span className="text-3xl font-bold text-primary">+{earnedPoints}</span>
              </div>
              <div className="w-px h-12 bg-border"></div>
              <div className="flex flex-col items-center">
                <span className="text-sm text-muted-foreground uppercase font-semibold">Time</span>
                <span className="text-3xl font-bold">{formatTime(currentResult?.totalTimeMs || 0)}</span>
              </div>
              <div className="w-px h-12 bg-border"></div>
              <div className="flex flex-col items-center">
                <span className="text-sm text-muted-foreground uppercase font-semibold">Total Score</span>
                <span className="text-3xl font-bold">{currentTotalScore}</span>
              </div>
            </div>

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