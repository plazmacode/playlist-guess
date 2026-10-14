import { useMemo, useState } from "react";
import { Check, Minus, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminPlaylist, AdminSong } from "@/hooks/useAdminAPI";

type Membership = "all" | "in" | "out";

interface AdminSongListProps {
  songs: AdminSong[];
  playlists: AdminPlaylist[];
  selectedPlaylist: AdminPlaylist | null;
  onAdd: (songIds: number[]) => Promise<unknown>;
  onRemove: (songIds: number[]) => Promise<unknown>;
  onRename: (songId: number, title: string) => Promise<unknown>;
}

export function AdminSongList({ songs, playlists, selectedPlaylist, onAdd, onRemove, onRename }: AdminSongListProps) {
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState("");
  const [membership, setMembership] = useState<Membership>("all");
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<{ id: number; title: string } | null>(null);

  const folders = useMemo(() => [...new Set(songs.map((s) => s.folder))].sort(), [songs]);
  const playlistNames = useMemo(() => new Map(playlists.map((p) => [p.id, p.name])), [playlists]);

  const isIn = (song: AdminSong) => !!selectedPlaylist && song.playlistIds.includes(selectedPlaylist.id);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return songs.filter((song) => {
      if (query && !song.title.toLowerCase().includes(query) && !song.relativePath.toLowerCase().includes(query)) return false;
      if (folder && song.folder !== folder) return false;
      if (selectedPlaylist && membership !== "all") {
        const inPlaylist = song.playlistIds.includes(selectedPlaylist.id);
        if (membership === "in" ? !inPlaylist : inPlaylist) return false;
      }
      return true;
    });
  }, [songs, search, folder, membership, selectedPlaylist]);

  const checkedVisible = visible.filter((s) => checked.has(s.id)).map((s) => s.id);
  const allVisibleChecked = visible.length > 0 && checkedVisible.length === visible.length;

  const toggleChecked = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllVisible = () =>
    setChecked(allVisibleChecked ? new Set() : new Set(visible.map((s) => s.id)));

  const bulk = async (action: (ids: number[]) => Promise<unknown>) => {
    await action(checkedVisible);
    setChecked(new Set());
  };

  const saveTitle = async () => {
    if (!editing) return;
    const original = songs.find((s) => s.id === editing.id)?.title;
    if (editing.title.trim() && editing.title.trim() !== original) {
      await onRename(editing.id, editing.title.trim());
    }
    setEditing(null);
  };

  const filterButton = (value: Membership, label: string) => (
    <button
      onClick={() => setMembership(value)}
      className={`rounded-md px-3 py-1 text-sm transition-colors ${
        membership === value ? "bg-pink-600 text-white" : "bg-secondary/40 text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-48 flex-1 items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search songs..."
            className="w-full bg-transparent outline-none"
          />
        </label>
        <select
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2"
        >
          <option value="">All folders</option>
          {folders.map((f) => (
            <option key={f} value={f}>
              {f || "(root)"}
            </option>
          ))}
        </select>
        {selectedPlaylist && (
          <div className="flex gap-1">
            {filterButton("all", "All")}
            {filterButton("in", "In playlist")}
            {filterButton("out", "Not in playlist")}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md bg-secondary/20 px-3 py-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={allVisibleChecked} onChange={toggleAllVisible} className="size-4" />
          {checkedVisible.length > 0 ? `${checkedVisible.length} selected` : `${visible.length} songs`}
        </label>
        {selectedPlaylist && checkedVisible.length > 0 && (
          <div className="ml-auto flex gap-2">
            <Button size="sm" className="bg-pink-600 text-white hover:bg-pink-800" onClick={() => bulk(onAdd)}>
              <Plus /> Add to {selectedPlaylist.name}
            </Button>
            <Button size="sm" variant="outline" onClick={() => bulk(onRemove)}>
              <Minus /> Remove from {selectedPlaylist.name}
            </Button>
          </div>
        )}
        {!selectedPlaylist && (
          <span className="ml-auto text-muted-foreground">Select a playlist on the left to add or remove songs.</span>
        )}
      </div>

      <ul className="divide-y divide-border rounded-md border border-border">
        {visible.map((song) => (
          <li key={song.id} className={`flex items-center gap-3 px-3 py-2 ${song.isMissing ? "opacity-50" : ""}`}>
            <input
              type="checkbox"
              checked={checked.has(song.id)}
              onChange={() => toggleChecked(song.id)}
              className="size-4 shrink-0"
            />
            <div className="min-w-0 flex-1">
              {editing?.id === song.id ? (
                <input
                  autoFocus
                  value={editing.title}
                  onChange={(e) => setEditing({ id: song.id, title: e.target.value })}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle();
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="w-full rounded border border-input bg-background px-2 py-0.5"
                />
              ) : (
                <button
                  onClick={() => setEditing({ id: song.id, title: song.title })}
                  className="group flex max-w-full items-center gap-2 text-left"
                  title="Rename (this is what players have to guess)"
                >
                  <span className="truncate">{song.title}</span>
                  <Pencil className="size-3 shrink-0 opacity-0 group-hover:opacity-60" />
                </button>
              )}
              <div className="flex flex-wrap gap-1 pt-0.5 text-xs text-muted-foreground">
                <span>{song.folder || "(root)"}</span>
                {song.isMissing && <span className="text-red-400">· file missing</span>}
                {song.playlistIds.map((id) => (
                  <span key={id} className="rounded bg-secondary/60 px-1.5">
                    {playlistNames.get(id)}
                  </span>
                ))}
              </div>
            </div>
            {selectedPlaylist && (
              <button
                onClick={() => (isIn(song) ? onRemove([song.id]) : onAdd([song.id]))}
                title={isIn(song) ? `Remove from ${selectedPlaylist.name}` : `Add to ${selectedPlaylist.name}`}
                className={`flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  isIn(song)
                    ? "border-pink-600 bg-pink-600 text-white hover:bg-pink-800"
                    : "border-border text-muted-foreground hover:border-pink-600"
                }`}
              >
                {isIn(song) ? <Check className="size-4" /> : <Plus className="size-4" />}
              </button>
            )}
          </li>
        ))}
        {visible.length === 0 && <li className="px-3 py-8 text-center text-muted-foreground">No songs match.</li>}
      </ul>
    </div>
  );
}

export default AdminSongList;
