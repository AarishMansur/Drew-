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
    <div className="min-h-screen bg-[#F0F0F0] p-10">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight google-sans text-gray-900">
            Your Spaces
          </h1>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="px-4 py-2 border-2 border-gray-900 rounded-xl text-gray-900 font-medium hover:bg-gray-100 transition-all"
          >
            Sign Out
          </button>
        </div>

        {/* Create space */}
        <div className="flex gap-3 mb-10">
          <input
            className="flex-1 px-4 py-3 border-2 border-gray-900 rounded-xl text-gray-900 bg-white focus:ring-2 focus:ring-gray-900 outline-none"
            placeholder="New space name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />

          <button
            onClick={createSpace}
            disabled={loading}
            className="px-6 py-3 border-2 border-gray-900 rounded-xl bg-black text-white font-semibold hover:bg-gray-800 transition-all disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>

        {/* List */}
        <div className="space-y-4">
          {spaces.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-5 bg-white border-2 border-gray-900 rounded-xl"
            >
              <div>
                <button
                  onClick={() => navigate(`/spaces/${s.id}`)}
                  className="text-lg font-semibold text-gray-900 hover:underline"
                >
                  {s.name}
                </button>

                <p className="text-xs text-gray-500 mt-1">
                  {inviteLink(s.id)}
                </p>
              </div>

              <button
                onClick={() => navigator.clipboard.writeText(inviteLink(s.id))}
                className="px-4 py-2 border-2 border-gray-900 rounded-xl text-sm font-medium hover:bg-gray-100 transition-all"
              >
                Copy Link
              </button>
            </div>
          ))}

          {spaces.length === 0 && (
            <p className="text-gray-500 text-center mt-10 text-sm">
              You haven't created any spaces yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
