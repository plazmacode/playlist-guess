import { type ProcessedSong } from "@/components/SetupGame";

export const INTERVALS = [0.5, 1, 2, 5, 10];

export interface GameResult {
  song: ProcessedSong;
  guessedCorrectly: boolean;
  attemptsUsed: number;
  userGuess: string | null;
  guessHistory: Array<'correct' | 'artist' | 'wrong' | 'skipped'>;
  firstAttemptThinkingTimeMs?: number;
  totalTimeMs?: number;
}

export const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((ms % 1000) / 100);

  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
  }
  return `${seconds}.${tenths}s`;
};

export const extractArtists = (title: string): string[] => {
  const parts = title.split('-');
  const artists: string[] = [];

  const splitAndClean = (str: string) => {
    const segments = str.split(/,|\s+&\s+|\s+and\s+|\s+feat\.?\s+|\s+ft\.?\s+|\s+vs\.?\s+|\s+x\s+/i);
    segments.forEach(seg => {
      const cleaned = seg.trim().toLowerCase();
      if (cleaned) artists.push(cleaned);
    });
  };

  if (parts.length > 0) {
    splitAndClean(parts[0]);
  }

  if (parts.length > 1) {
    const restOfTitle = parts.slice(1).join('-');
    const remixMatch = restOfTitle.match(/\(([^)]+)\)|\[([^\]]+)\]/g);

    if (remixMatch) {
      remixMatch.forEach(match => {
        let inside = match.replace(/[()[\]]/g, '').toLowerCase();
        const keywords = ['remix', 'bootleg', 'refix', 'edit', 'flip', 'mashup', 'mix', 'by', 'vip'];
        keywords.forEach(kw => {
          inside = inside.replace(new RegExp(`\\b${kw}\\b`, 'gi'), '');
        });
        splitAndClean(inside);
      });
    }
  }
  return artists;
};

export const calculatePoints = (result: GameResult) => {
  const baseScores = [90, 80, 70, 60, 50]; 
  const artistScores = [45, 40, 35, 30, 25]; 
  let points = 0;
  const gracePeriodMs = 10000; // Time in ms for full bonus on first attempt

  if (result.guessedCorrectly) {
    points = baseScores[result.attemptsUsed - 1] || 50;
    if (result.attemptsUsed === 1 && result.firstAttemptThinkingTimeMs !== undefined) {
      const timeMs = result.firstAttemptThinkingTimeMs;
      if (timeMs <= gracePeriodMs) {
        points += 10; 
      } else {
        const secondsLate = Math.floor((timeMs - gracePeriodMs) / 1000);
        points += Math.max(0, 10 - secondsLate);
      }
    }
  } else if (result.guessHistory.includes('artist')) {
    const earliestArtistMatch = result.guessHistory.indexOf('artist');
    points = artistScores[earliestArtistMatch] || 25;
  }
  return points;
};

export function seededRandom(seed: number) {
  return () => {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mathematically unbiased shuffle (Fisher-Yates algorithm)
export const shuffleArray = <T,>(array: T[], seed?: number): T[] => {
  const shuffled = [...array];
  const random = seed !== undefined ? seededRandom(seed) : Math.random;

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
};

// Spreads 100% evenly across however many folders are selected, giving the
// leftover percentage points (from integer division) to the first folders.
export function distributeEvenly(folders: string[]): Record<string, number> {
  if (folders.length === 0) return {};
  const even = Math.floor(100 / folders.length);
  const remainder = 100 - even * folders.length;
  const result: Record<string, number> = {};
  folders.forEach((folder, i) => {
    result[folder] = even + (i < remainder ? 1 : 0);
  });
  return result;
}
