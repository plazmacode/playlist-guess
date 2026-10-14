import { useCallback, useEffect, useState } from "react";
import { authFetch } from "@/lib/auth";

export interface ApiSong {
  id: number;
  title: string; 
  fileName: string;
}

export interface ApiPlaylist {
  id: number;
  name: string;
  description: string;
  isPublic: boolean;
  songCount: number;
}

export interface PlaylistSplit {
  playlistId: number;
  percentage: number;
}

export interface PlaylistRequest {
  totalCount: number;
  splits: PlaylistSplit[];
}
 
export interface PlaylistResult {
  songs: ApiSong[];
  warnings: string[];
}


export function useStreamingAPI() {
  const [status, setStatus] = useState(Boolean);
  const [songs, setSongs] = useState<ApiSong[]>([]);
  const [playlists, setPlaylists] = useState<ApiPlaylist[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const baseUrl = import.meta.env.VITE_API_BASE_URL;

  useEffect(() => {
    const getAPIStatus = async() => {
      try {
        const response = await authFetch(`${baseUrl}/status`);
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
      const response = await authFetch(`${baseUrl}/songs`);
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
  }, [baseUrl]);
  
  const fetchPlaylists = useCallback(async () => {
    try {
      const response = await authFetch(`${baseUrl}/playlists`);
      if (!response.ok) {
        throw new Error("Failed to fetch playlists from the server.");
      }
      const data: ApiPlaylist[] = await response.json();
      setPlaylists(data);
    } catch (err) {
      console.error(err);
    }
  }, [baseUrl]);

  const fetchPlaylist = useCallback(async (request: PlaylistRequest): Promise<PlaylistResult | null> => {
    setError(null);
    try {
      const response = await authFetch(`${baseUrl}/playlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
 
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Failed to build playlist from the server.");
      }
 
      const data: PlaylistResult = await response.json();
 
      if (data.warnings.length > 0) {
        console.warn("Playlist warnings:", data.warnings);
      }
 
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
      console.error(err);
      return null;
    }
  }, [baseUrl]);


  const getStreamUrl = (id: number) => {
    return `${baseUrl}/songs/${id}/stream`;
  };

  return {
    status,
    songs,
    playlists,
    isLoading,
    error,
    fetchSongs,
    fetchPlaylists,
    fetchPlaylist,
    getStreamUrl
  };
}