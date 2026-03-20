import { type ProcessedSong } from "@/components/SetupGame";

export const INTERVALS = [0.5, 1, 2, 5, 10];

export interface GameResult {
  song: ProcessedSong;
  guessedCorrectly: boolean;
  attemptsUsed: number;
  userGuess: string | null;
  guessHistory: Array<'correct' | 'artist' | 'wrong' | 'skipped'>;
  firstAttemptThinkingTimeMs?: number;
}

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
  const gracePeriodMs = 5000; // Time in ms for full bonus on first attempt

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