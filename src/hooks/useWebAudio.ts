import { useState, useRef, useEffect } from "react";
import { type ProcessedSong } from "@/components/SetupGame";

export function useWebAudio(
  currentSong: ProcessedSong,
  currentAllowedTime: number,
  volume: number,
  attemptStep: number,
  maxSnippetDuration: number
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [snippetStart, setSnippetStart] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const playbackEndedAtRef = useRef<number | null>(null);

  const resetPlayer = () => {
    setIsReady(false);
    setSnippetStart(0);
    setIsPlaying(false);
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

    const loadAndDecodeAudio = async () => {
      if (!audioCtxRef.current) return;

      try {
        const arrayBuffer = await currentSong.originalFile.arrayBuffer();
        const decodedData = await audioCtxRef.current.decodeAudioData(arrayBuffer);

        if (isCancelled) return;
        audioBufferRef.current = decodedData;

        const totalDuration = decodedData.duration;
        const minStart = totalDuration * 0.2; 
        const maxStart = totalDuration * 0.8 - maxSnippetDuration; 

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
      if (attemptStep === 0) playbackEndedAtRef.current = Date.now();
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
    playSnippet,
    pauseAudio,
    audioRef,
    playbackEndedAtRef,
    resetPlayer
  };
}