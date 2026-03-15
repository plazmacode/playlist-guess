import { type GameResult } from "./Game";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

interface EndScreenProps {
  results: GameResult[];
  onRestart: () => void;
}

export default function EndScreen({ results, onRestart }: EndScreenProps) {
  const correctCount = results.filter(r => r.guessedCorrectly).length;

  return (
    <div className="flex flex-col items-center mt-8 w-full max-w-3xl mx-auto px-4">
      <h1 className="text-4xl font-bold mb-2">Game Over!</h1>
      <p className="text-xl text-muted-foreground mb-8">
        You got {correctCount} out of {results.length} correct.
      </p>

      <div className="w-full space-y-4 mb-8">
        {results.map((result, index) => (
          <div 
            key={index} 
            className={`p-4 rounded-lg border flex flex-col gap-4 ${
              result.guessedCorrectly ? "bg-green-500/10 border-green-500/50" : "bg-red-500/10 border-red-500/50"
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                {result.guessedCorrectly ? (
                  <CheckCircle2 className="text-green-500 h-6 w-6" />
                ) : (
                  <XCircle className="text-red-500 h-6 w-6" />
                )}
                <div>
                  <h3 className="font-bold text-lg">{result.song.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {result.guessedCorrectly 
                      ? `Guessed in ${result.attemptsUsed} attempt(s)`
                      : `Your final guess: ${result.userGuess || "None"}`
                    }
                  </p>
                </div>
              </div>
            </div>
            
            {/* Native audio player so the user can listen to the full song */}
            <audio 
              src={result.song.previewUrl} 
              controls 
              className="w-full h-10" 
            />
          </div>
        ))}
      </div>

      <Button size="lg" onClick={onRestart} className="w-full max-w-sm text-lg h-14">
        Play Again
      </Button>
    </div>
  );
}