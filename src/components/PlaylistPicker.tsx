import { useMemo, useState } from "react";
import { Check, Lock, Search, Shuffle } from "lucide-react";
import type { ProcessedSong } from "@/components/SetupGame";
import type { ApiPlaylist, ApiSong, PlaylistRequest, PlaylistResult } from "@/hooks/useStreamingAPI";
import { distributeEvenly } from "@/lib/game-utils";

interface PlaylistPickerProps {
  playlists: ApiPlaylist[];
  apiSongs: ApiSong[];
  getStreamUrl: (id: number) => string;
  fetchPlaylist: (request: PlaylistRequest) => Promise<PlaylistResult | null>;
  onStart: (songs: ProcessedSong[], seed?: number, maxSongs?: number, apiSongs?: ProcessedSong[]) => void;
}

// Pseudo-playlist key for "every song the server will give us".
const ALL_SONGS = "all";

export function PlaylistPicker({ playlists, apiSongs, getStreamUrl, fetchPlaylist, onStart }: PlaylistPickerProps) {
  const [search, setSearch] = useState("");
  // Selected playlist ids (as strings, plus ALL_SONGS) mapped to their share in percent.
  const [selected, setSelected] = useState<Record<string, number>>({ [ALL_SONGS]: 100 });
  const [totalCount, setTotalCount] = useState(10);
  const [seedInput, setSeedInput] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return playlists;
    return playlists.filter(
      (p) => p.name.toLowerCase().includes(query) || p.description.toLowerCase().includes(query)
    );
  }, [playlists, search]);

  const selectedKeys = Object.keys(selected);
  const splitSum = Object.values(selected).reduce((a, b) => a + b, 0);
  const isAllSongs = ALL_SONGS in selected;
  const playlistName = (key: string) =>
    key === ALL_SONGS ? "All songs" : playlists.find((p) => p.id.toString() === key)?.name ?? key;

  const toggle = (key: string) => {
    setError(null);
    setSelected((prev) => {
      // "All songs" can't be mixed with real playlists.
      if (key === ALL_SONGS) return { [ALL_SONGS]: 100 };
      const keys = Object.keys(prev).filter((k) => k !== ALL_SONGS);
      const next = key in prev ? keys.filter((k) => k !== key) : [...keys, key];
      return next.length === 0 ? { [ALL_SONGS]: 100 } : distributeEvenly(next);
    });
  };

  const toProcessed = (songs: ApiSong[]): ProcessedSong[] =>
    songs.map((song) => ({ id: song.id.toString(), title: song.title, previewUrl: getStreamUrl(song.id) }));

  const resolveSeed = async (): Promise<number> => {
    const parsed = parseInt(seedInput, 10);
    if (seedInput.trim() !== "" && !isNaN(parsed)) return parsed;

    const generated = Math.floor(100000 + Math.random() * 900000);
    try {
      await navigator.clipboard.writeText(generated.toString());
    } catch (err) {
      console.error("Failed to copy seed to clipboard", err);
    }
    return generated;
  };

  const handleStart = async () => {
    setError(null);
    if (totalCount <= 0) {
      setError("Song count must be greater than 0.");
      return;
    }

    const allSongs = toProcessed(apiSongs);

    if (isAllSongs) {
      onStart(allSongs, await resolveSeed(), totalCount);
      return;
    }

    if (Math.abs(splitSum - 100) > 0.5) {
      setError(`Percentages must add up to 100 (currently ${splitSum}).`);
      return;
    }

    const splits = selectedKeys
      .map((key) => ({ playlistId: Number(key), percentage: selected[key] }))
      .filter((s) => s.percentage > 0);

    setIsStarting(true);
    const result = await fetchPlaylist({ totalCount, splits });
    setIsStarting(false);

    if (!result) {
      setError("Couldn't build a playlist from the server.");
      return;
    }

    const resultSongs = toProcessed(result.songs);
    onStart(resultSongs, await resolveSeed(), resultSongs.length, allSongs);
  };

  const cardClass = (isSelected: boolean) =>
    `relative flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors ${
      isSelected
        ? "border-pink-600 bg-pink-600/15 ring-2 ring-pink-600"
        : "border-border bg-secondary/20 hover:border-pink-600/60 hover:bg-secondary/40"
    }`;

  return (
    <section className="mx-auto w-full max-w-6xl px-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pick your playlists</h1>
          <p className="text-sm text-muted-foreground">
            Select one or more. Mixing playlists splits the songs between them.
          </p>
        </div>
        <label className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 py-2 sm:w-72">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search playlists..."
            className="w-full bg-transparent outline-none"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {!search && (
          <button onClick={() => toggle(ALL_SONGS)} className={cardClass(isAllSongs)}>
            <span className="flex items-center gap-2 text-lg font-semibold">
              <Shuffle className="size-4" /> All songs
            </span>
            <span className="text-sm text-muted-foreground">Everything you have access to, shuffled.</span>
            <span className="mt-auto pt-2 text-xs text-muted-foreground">{apiSongs.length} songs</span>
            {isAllSongs && <Check className="absolute top-3 right-3 size-5 text-pink-500" />}
          </button>
        )}
        {filtered.map((playlist) => {
          const key = playlist.id.toString();
          const isSelected = key in selected;
          return (
            <button key={playlist.id} onClick={() => toggle(key)} className={cardClass(isSelected)}>
              <span className="flex items-center gap-2 pr-6 text-lg font-semibold break-all">
                {!playlist.isPublic && <Lock className="size-4 shrink-0 text-muted-foreground" />}
                {playlist.name}
              </span>
              {playlist.description && (
                <span className="line-clamp-2 text-sm text-muted-foreground">{playlist.description}</span>
              )}
              <span className="mt-auto pt-2 text-xs text-muted-foreground">
                {playlist.songCount} songs
                {isSelected && selectedKeys.length > 1 && ` · ${selected[key]}%`}
              </span>
              {isSelected && <Check className="absolute top-3 right-3 size-5 text-pink-500" />}
            </button>
          );
        })}
        {filtered.length === 0 && search && (
          <p className="col-span-full py-8 text-center text-muted-foreground">No playlists match "{search}".</p>
        )}
      </div>

      {/* Sticky so the start button stays reachable when the playlist grid gets long. */}
      <div className="sticky bottom-0 z-10 mt-6 mb-8 rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur">
        {selectedKeys.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {selectedKeys.map((key) => (
              <div key={key} className="flex items-center gap-2 rounded-md bg-secondary/40 px-3 py-1">
                <span className="max-w-40 truncate text-sm">{playlistName(key)}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={selected[key]}
                  onChange={(e) => setSelected((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                  className="w-16 rounded border border-input bg-background px-2 py-0.5 text-right"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            ))}
            <span className={`self-center text-sm ${Math.abs(splitSum - 100) > 0.5 ? "text-red-400" : "text-green-400"}`}>
              Total: {splitSum}%
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Songs
            <input
              type="number"
              min={1}
              value={totalCount}
              onChange={(e) => setTotalCount(Number(e.target.value))}
              className="w-20 rounded border border-input bg-background px-2 py-1 text-foreground"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Seed
            <input
              type="number"
              placeholder="Random"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              className="w-32 rounded border border-input bg-background px-2 py-1 text-foreground"
            />
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            onClick={handleStart}
            disabled={isStarting}
            className="rounded-md bg-pink-600 px-8 py-3 text-white transition-colors hover:bg-pink-800 disabled:opacity-50 sm:ml-auto"
          >
            {isStarting ? "Building playlist..." : "Start game and copy seed"}
          </button>
        </div>
      </div>
    </section>
  );
}

export default PlaylistPicker;
