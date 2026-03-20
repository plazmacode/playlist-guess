import { Button } from "@/components/ui/button";
import { calculatePoints, formatTime, type GameResult } from "@/lib/game-utils";
import { CheckCircle2, XCircle, UserCheck, Timer } from "lucide-react"; 

interface EndScreenProps {
  results: GameResult[];
  onRestart: () => void;
}

export default function EndScreen({ results, onRestart }: EndScreenProps) {

  const totalScore = results.reduce((sum, res) => sum + calculatePoints(res), 0);
  const totalGameTimeMs = results.reduce((sum, res) => sum + (res.totalTimeMs || 0), 0);

  return (
    <div className="flex flex-col items-center mt-8 w-full max-w-3xl mx-auto px-4 pb-12">
      <h1 className="text-4xl font-bold mb-2">Game Over!</h1>
      
      <div className="flex flex-col items-center my-6">
        <div className="text-6xl font-black text-primary tracking-tighter">
          {totalScore} <span className="text-3xl text-muted-foreground font-semibold">/ 1000</span>
        </div>
        <div className="flex items-center gap-2 mt-2 text-muted-foreground font-semibold bg-secondary/50 px-4 py-1.5 rounded-full">
          <Timer className="w-4 h-4" />
          <span>Total Time: {formatTime(totalGameTimeMs)}</span>
        </div>
      </div>

      <div className="w-full space-y-4 mb-8">
        {results.map((result, index) => {
          const points = calculatePoints(result);
          const isArtistMatch = !result.guessedCorrectly && result.guessHistory.includes('artist');
          
          // Determine styling based on result type
          let boxColor = "bg-red-500/10 border-red-500/50";
          let icon = <XCircle className="text-red-500 h-6 w-6 shrink-0" />;
          let statusText = `Final guess: ${result.userGuess || "None"}`;

          if (result.guessedCorrectly) {
            boxColor = "bg-green-500/10 border-green-500/50";
            icon = <CheckCircle2 className="text-green-500 h-6 w-6 shrink-0" />;
            statusText = `Guessed in ${result.attemptsUsed} attempt(s)`;
          } else if (isArtistMatch) {
            boxColor = "bg-yellow-500/10 border-yellow-500/50";
            icon = <UserCheck className="text-yellow-600 dark:text-yellow-500 h-6 w-6 shrink-0" />;
            statusText = `Artist matched: ${result.userGuess}`;
          }

          return (
            <div key={index} className={`p-4 rounded-lg border flex flex-col gap-4 ${boxColor}`}>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 overflow-hidden">
                  {icon}
                  <div className="truncate pr-4">
                    <h3 className="font-bold text-lg truncate">{result.song.title}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground truncate mt-1">
                      <span>{statusText}</span>
                      <span className="flex items-center gap-1">
                        <Timer className="w-3 h-3 opacity-50" />
                        {formatTime(result.totalTimeMs || 0)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end shrink-0 pl-4 border-l border-foreground/10">
                  <div className="text-2xl font-bold">{points}</div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Points</div>
                </div>
              </div>
              
              <audio src={result.song.previewUrl} controls className="w-full h-10" />
            </div>
          );
        })}
      </div>

      <Button size="lg" onClick={onRestart} className="w-full max-w-sm text-lg h-14">
        Play Again
      </Button>
    </div>
  );
}