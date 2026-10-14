import { useCallback, useState } from "react";
import { authFetch } from "@/lib/auth";

export interface AdminSong {
  id: number;
  title: string;
  fileName: string;
  relativePath: string;
  folder: string;
  isMissing: boolean;
  addedAt: string;
  playlistIds: number[];
}

export interface AdminPlaylist {
  id: number;
  name: string;
  description: string;
  isPublic: boolean;
  sourceFolder: string | null;
  songCount: number;
  createdAt: string;
}

export interface SavePlaylist {
  name: string;
  description: string;
  isPublic: boolean;
}

export interface SyncResult {
  added: number;
  missing: number;
  restored: number;
  total: number;
}

export function useAdminAPI() {
  const [songs, setSongs] = useState<AdminSong[]>([]);
  const [playlists, setPlaylists] = useState<AdminPlaylist[]>([]);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = `${import.meta.env.VITE_API_BASE_URL}/admin`;

  // Every call reloads songs + playlists afterwards; the library is small enough
  // that this is simpler than patching local state.
  const request = useCallback(
    async <T,>(path: string, method = "GET", body?: unknown): Promise<T | null> => {
      setError(null);
      try {
        const response = await authFetch(`${baseUrl}${path}`, {
          method,
          headers: body ? { "Content-Type": "application/json" } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.message ?? `Request failed (${response.status}).`);
        }
        return response.status === 204 ? null : ((await response.json()) as T);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unknown error occurred");
        return null;
      }
    },
    [baseUrl]
  );

  const refresh = useCallback(async () => {
    const [nextSongs, nextPlaylists] = await Promise.all([
      request<AdminSong[]>("/songs"),
      request<AdminPlaylist[]>("/playlists"),
    ]);
    if (nextSongs) setSongs(nextSongs);
    if (nextPlaylists) setPlaylists(nextPlaylists);
  }, [request]);

  const withRefresh =
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A) => {
      const result = await fn(...args);
      await refresh();
      return result;
    };

  return {
    songs,
    playlists,
    error,
    refresh,
    createPlaylist: withRefresh((playlist: SavePlaylist) => request<{ id: number }>("/playlists", "POST", playlist)),
    updatePlaylist: withRefresh((id: number, playlist: SavePlaylist) => request(`/playlists/${id}`, "PUT", playlist)),
    deletePlaylist: withRefresh((id: number) => request(`/playlists/${id}`, "DELETE")),
    addSongs: withRefresh((id: number, songIds: number[]) => request(`/playlists/${id}/songs/add`, "POST", { songIds })),
    removeSongs: withRefresh((id: number, songIds: number[]) =>
      request(`/playlists/${id}/songs/remove`, "POST", { songIds })
    ),
    renameSong: withRefresh((id: number, title: string) => request(`/songs/${id}`, "PATCH", { title })),
    rescan: withRefresh(() => request<SyncResult>("/rescan", "POST")),
  };
}
