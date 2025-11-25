import { useEffect, useState } from "react";
import { supabase } from "../lib/supaBaseClient";
import { useAppSelector } from "../app/store";
import { useNavigate } from "react-router-dom";

type Space = {
  id: string;
  name: string;
};

export default function SpacesPage() {
  const user = useAppSelector((s) => s.auth.user)!;
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchSpaces = async () => {
    const { data, error } = await supabase
      .from("spaces")
      .select("id, name")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });

    if (!error && data) setSpaces(data as Space[]);
  };

  useEffect(() => {
    fetchSpaces();
  }, []);

  const createSpace = async () => {
    if (!newName.trim()) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("spaces")
      .insert([{ name: newName, owner_id: user.id }])
      .select("id, name")
      .single();
    setLoading(false);
    if (error) return;
    setSpaces((prev) => [...prev, data as Space]);
    setNewName("");
  };

  const inviteLink = (id: string) =>
    `${window.location.origin}/spaces/${id}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-semibold">Spaces</h1>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/login";
            }}
            className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm"
          >
            Sign out
          </button>
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
            placeholder="New space name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button
            onClick={createSpace}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>

        <ul className="space-y-2">
          {spaces.map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between bg-slate-900 p-3 rounded-lg"
            >
              <div>
                <button
                  onClick={() => navigate(`/spaces/${s.id}`)}
                  className="font-medium hover:underline"
                >
                  {s.name}
                </button>
                <p className="text-xs text-slate-400">
                  Invite link: {inviteLink(s.id)}
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink(s.id));
                }}
                className="px-3 py-1 rounded bg-slate-700 text-xs"
              >
                Copy link
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
