export const calculatePoints = (result: GameResult) => {
  const baseScores = [90, 80, 70, 60, 50]; 
  const artistScores = [45, 40, 35, 30, 25]; 
  let points = 0;

  if (result.guessedCorrectly) {
    points = baseScores[result.attemptsUsed - 1] || 50;
    if (result.attemptsUsed === 1 && result.firstAttemptThinkingTimeMs !== undefined) {
      const timeMs = result.firstAttemptThinkingTimeMs;
      if (timeMs <= 3000) {
        points += 10; // Perfect 100
      } else {
        const secondsLate = Math.floor((timeMs - 3000) / 1000);
        points += Math.max(0, 10 - secondsLate);
      }
    }
  } else if (result.guessHistory.includes('artist')) {
    const earliestArtistMatch = result.guessHistory.indexOf('artist');
    points = artistScores[earliestArtistMatch] || 25;
  }
  return points;
};