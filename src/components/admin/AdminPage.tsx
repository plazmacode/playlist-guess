import { useEffect, useState, type FormEvent } from "react";
import { Lock, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LoginForm from "@/components/LoginForm";
import AdminSongList from "@/components/admin/AdminSongList";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAPI, type AdminPlaylist, type SavePlaylist } from "@/hooks/useAdminAPI";

export function AdminPage() {
  const { isAdmin, isLoggedIn } = useAuth();

  if (!isAdmin) {
    return (
      <div className="mx-auto mt-16 flex max-w-sm flex-col gap-4 px-4">
        <h1 className="text-center text-3xl font-bold">Admin</h1>
        {isLoggedIn && (
          <p className="text-center text-sm text-muted-foreground">
            You're logged in, but not as admin. Log in with the admin password to continue.
          </p>
        )}
        <LoginForm />
        <a href="#" className="text-center text-sm text-muted-foreground underline">
          Back to the game
        </a>
      </div>
    );
  }

  return <AdminDashboard />;
}

function AdminDashboard() {
  const admin = useAdminAPI();
  const { refresh } = admin;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const selected = admin.playlists.find((p) => p.id === selectedId) ?? null;

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const created = await admin.createPlaylist({ name: newName, description: "", isPublic: false });
    if (created) {
      setNewName("");
      setSelectedId(created.id);
    }
  };

  const handleRescan = async () => {
    setScanMessage("Scanning...");
    const result = await admin.rescan();
    setScanMessage(
      result ? `${result.added} added, ${result.missing} missing, ${result.restored} restored (${result.total} total)` : null
    );
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">Library admin</h1>
        <span className="text-sm text-muted-foreground">
          {admin.songs.length} songs · {admin.playlists.length} playlists
        </span>
        <div className="ml-auto flex items-center gap-2">
          {scanMessage && <span className="text-sm text-muted-foreground">{scanMessage}</span>}
          <Button variant="outline" onClick={handleRescan}>
            <RefreshCw /> Rescan music folder
          </Button>
        </div>
      </div>

      {admin.error && <p className="mb-4 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-400">{admin.error}</p>}

      <div className="grid gap-6 lg:grid-cols-[18rem_1fr]">
        <aside className="flex flex-col gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start">
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New playlist name" />
            <Button type="submit" disabled={!newName.trim()} className="bg-pink-600 text-white hover:bg-pink-800">
              <Plus />
            </Button>
          </form>
          <ul className="flex flex-col gap-1 overflow-y-auto">
            {admin.playlists.map((playlist) => (
              <li key={playlist.id}>
                <button
                  onClick={() => setSelectedId(playlist.id === selectedId ? null : playlist.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left transition-colors ${
                    playlist.id === selectedId ? "bg-pink-600 text-white" : "hover:bg-secondary/40"
                  }`}
                >
                  {!playlist.isPublic && <Lock className="size-3.5 shrink-0 opacity-70" />}
                  <span className="flex-1 truncate">{playlist.name}</span>
                  <span className="text-xs opacity-70">{playlist.songCount}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="flex min-w-0 flex-col gap-6">
          {selected && (
            <PlaylistEditor
              key={selected.id}
              playlist={selected}
              onSave={(values) => admin.updatePlaylist(selected.id, values)}
              onDelete={async () => {
                if (!window.confirm(`Delete playlist "${selected.name}"? Songs are kept.`)) return;
                await admin.deletePlaylist(selected.id);
                setSelectedId(null);
              }}
            />
          )}
          <AdminSongList
            songs={admin.songs}
            playlists={admin.playlists}
            selectedPlaylist={selected}
            onAdd={(ids) => admin.addSongs(selected!.id, ids)}
            onRemove={(ids) => admin.removeSongs(selected!.id, ids)}
            onRename={admin.renameSong}
          />
        </main>
      </div>
    </div>
  );
}

interface PlaylistEditorProps {
  playlist: AdminPlaylist;
  onSave: (values: SavePlaylist) => Promise<unknown>;
  onDelete: () => void;
}

function PlaylistEditor({ playlist, onSave, onDelete }: PlaylistEditorProps) {
  const [values, setValues] = useState<SavePlaylist>({
    name: playlist.name,
    description: playlist.description,
    isPublic: playlist.isPublic,
  });

  const isDirty =
    values.name !== playlist.name || values.description !== playlist.description || values.isPublic !== playlist.isPublic;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          placeholder="Name"
          className="sm:max-w-xs"
        />
        <Input
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
          placeholder="Description (shown on the selection screen)"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.isPublic}
            onChange={(e) => setValues({ ...values, isPublic: e.target.checked })}
            className="size-4"
          />
          Public (playable without logging in)
        </label>
        {playlist.sourceFolder !== null && (
          <span className="text-xs text-muted-foreground">
            Auto-filled with new songs from the "{playlist.sourceFolder}" folder
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="destructive" onClick={onDelete}>
            Delete
          </Button>
          <Button
            disabled={!isDirty || !values.name.trim()}
            onClick={() => onSave(values)}
            className="bg-pink-600 text-white hover:bg-pink-800"
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
