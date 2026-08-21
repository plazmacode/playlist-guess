import { useCallback, useEffect, useState } from "react";

export interface ApiSong {
  id: number;
  title: string; 
  fileName: string;
}

export function useStreamingAPI() {
  const [status, setStatus] = useState(Boolean);
  const [songs, setSongs] = useState<ApiSong[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const baseUrl = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    const getAPIStatus = async() => {
      try {
        const response = await fetch(`${baseUrl}/status`);
        console.log("API Status OK:", response.ok);
        setStatus(true);
      } catch(error) {
        setStatus(false);
        console.error("API Error:", error);
      }
    };
    getAPIStatus();
  },[baseUrl])

  const fetchSongs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/songs`);
      if (!response.ok) {
        throw new Error("Failed to fetch songs from the server.");
      }
      const data: ApiSong[] = await response.json();
      setSongs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getStreamUrl = (id: number) => {
    return `${baseUrl}/songs/${id}/stream`;
  };

  return {
    status,
    songs,
    isLoading,
    error,
    fetchSongs,
    getStreamUrl
  };
}