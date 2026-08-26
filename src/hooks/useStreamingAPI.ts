import { useCallback, useEffect, useState } from "react";

export interface ApiSong {
  id: number;
  title: string; 
  fileName: string;
}

export interface FolderSplit {
  folder: string;
  percentage: number;
}
 
export interface PlaylistRequest {
  totalCount: number;
  splits: FolderSplit[];
}
 
export interface PlaylistResult {
  songs: ApiSong[];
  warnings: string[];
}


export function useStreamingAPI() {
  const [status, setStatus] = useState(Boolean);
  const [songs, setSongs] = useState<ApiSong[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
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
  }, [baseUrl]);
  
  const fetchFolders = useCallback(async () => {
    try {
      const response = await fetch(`${baseUrl}/folders`);
      if (!response.ok) {
        throw new Error("Failed to fetch folders from the server.");
      }
      const data: string[] = await response.json();
      setFolders(data);
    } catch (err) {
      console.error(err);
    }
  }, [baseUrl]);

  const fetchPlaylist = useCallback(async (request: PlaylistRequest): Promise<PlaylistResult | null> => {
    setError(null);
    try {
      const response = await fetch(`${baseUrl}/playlist`, {
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
    folders,
    isLoading,
    error,
    fetchSongs,
    fetchFolders,
    fetchPlaylist,
    getStreamUrl
  };
}