import { useState, useRef, useEffect } from "react";
import { type ProcessedSong } from "@/components/SetupGame";
import { seededRandom } from "@/lib/game-utils";
import { authFetch } from "@/lib/auth";

export function useWebAudio(
  currentSong: ProcessedSong,
  currentAllowedTime: number,
  volume: number,
  attemptStep: number,
  maxSnippetDuration: number,
  seed?: number
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [snippetStart, setSnippetStart] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackEndedAtRef = useRef<number | null>(null);

  const resetPlayer = () => {
    setIsReady(false);
    setSnippetStart(0);
    setIsPlaying(false);
    setStreamUrl(null);
    playbackEndedAtRef.current = null;
  };

  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!audioCtxRef.current && AudioContextClass) {
      audioCtxRef.current = new AudioContextClass();
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch { /* safely ignore */ }
      sourceNodeRef.current.disconnect();
    }

    setStreamUrl(null);

    const loadAndDecodeAudio = async () => {
      if (!audioCtxRef.current) return;

      try {
        const response = await authFetch(currentSong.previewUrl);
        if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);

        // authFetch can't be used on a plain <audio src>, since custom headers (our JWT)
        // can't be attached to it. We fetch the bytes once here and hand the <audio>
        // element an object URL instead, so the full-song replay stays authenticated too.
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        if (isCancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        objectUrlRef.current = objectUrl;
        setStreamUrl(objectUrl);

        const arrayBuffer = await blob.arrayBuffer();
        const decodedData = await audioCtxRef.current.decodeAudioData(arrayBuffer);

        if (isCancelled) return;
        audioBufferRef.current = decodedData;

        const totalDuration = decodedData.duration;
        const minStart = totalDuration * 0.2; 
        const maxStart = totalDuration * 0.8 - maxSnippetDuration; 

        let start = 0;
        if (maxStart > minStart) {
          const random = seed !== undefined ? seededRandom(seed) : Math.random;

          start = random() * (maxStart - minStart) + minStart;

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
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [currentSong, maxSnippetDuration]);

  useEffect(() => {
    if (gainNodeRef.current) gainNodeRef.current.gain.value = volume;
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const playSnippet = () => {
    if (!audioCtxRef.current || !audioBufferRef.current) return;

    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch { /* safely ignore */ }
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
      if (attemptStep === 0 && playbackEndedAtRef.current === null) {
        playbackEndedAtRef.current = Date.now();
      }
    };
  };

  const pauseAudio = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch { /* safely ignore */ }
      setIsPlaying(false);
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };

  return {
    isReady,
    isPlaying,
    snippetStart,
    streamUrl,
    playSnippet,
    pauseAudio,
    audioRef,
    playbackEndedAtRef,
    resetPlayer
  };
}