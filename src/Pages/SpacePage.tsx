import { useEffect, useState } from "react";
import { supabase } from "../lib/supaBaseClient";
import { useAppSelector } from "../app/store";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import { isMissingRelation, type SpaceRole } from "../lib/sharing";

type SpaceCard = {
  id: string;
  name: string;
  role: SpaceRole;
};

type PendingInvite = {
  token: string;
  role: SpaceRole;
  spaceName: string;
};

export default function SpacesPage() {
  const user = useAppSelector((s) => s.auth.user)!;
  const [spaces, setSpaces] = useState<SpaceCard[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailBySpace, setEmailBySpace] = useState<Record<string, string>>({});
  const [roleBySpace, setRoleBySpace] = useState<Record<string, "editor" | "viewer">>({});
  const navigate = useNavigate();

  const fetchSpaces = async () => {
    const { data, error } = await supabase
      .from("space_members")
      .select("role, spaces(id, name)")
      .eq("user_id", user.id);

    if (error && isMissingRelation(error)) {
      const owned = await supabase
        .from("spaces")
        .select("id, name")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true });
      if (!owned.error && owned.data) {
        setSpaces(owned.data.map((space) => ({ id: space.id, name: space.name, role: "owner" })));
      }
      return;
    }

    if (error) {
      toast.error(error.message);
      return;
    }

    const cards: SpaceCard[] = [];
    for (const row of data ?? []) {
      const space = row.spaces as { id: string; name: string } | { id: string; name: string }[] | null;
      const record = Array.isArray(space) ? space[0] : space;
      if (!record) continue;
      cards.push({ id: record.id, name: record.name, role: row.role as SpaceRole });
    }
    setSpaces(cards);

    const pending = await supabase
      .from("space_invites")
      .select("token, role, created_by, spaces(name)")
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString());

    if (pending.error || !pending.data) return;
    const mine: PendingInvite[] = [];
    for (const row of pending.data) {
      if (row.created_by === user.id) continue;
      const space = row.spaces as { name: string } | { name: string }[] | null;
      const record = Array.isArray(space) ? space[0] : space;
      mine.push({
        token: row.token,
        role: row.role as SpaceRole,
        spaceName: record?.name || "a space",
      });
    }
    setInvites(mine);
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
    if (error || !data) {
      toast.error(error?.message || "Could not create space");
      return;
    }

    const member = await supabase.from("space_members").insert({
      space_id: data.id,
      user_id: user.id,
      role: "owner",
    });
    if (member.error && !isMissingRelation(member.error) && member.error.code !== "23505") {
      toast.error(member.error.message);
    }

    setSpaces((prev) => [...prev, { id: data.id, name: data.name, role: "owner" }]);
    setNewName("");
  };

  const createInvite = async (spaceId: string) => {
    const role = roleBySpace[spaceId] ?? "editor";
    const email = emailBySpace[spaceId]?.trim();
    const { data, error } = await supabase
      .from("space_invites")
      .insert({
        space_id: spaceId,
        role,
        email: email || null,
        created_by: user.id,
      })
      .select("token")
      .single();

    if (error || !data) {
      toast.error(
        isMissingRelation(error) ? "Run the sharing SQL in Supabase first" : error?.message || "Could not create invite"
      );
      return;
    }

    const link = `${window.location.origin}/invite/${data.token}`;
    await navigator.clipboard.writeText(link);
    toast.success("One-time invite link copied");
    setEmailBySpace((current) => ({ ...current, [spaceId]: "" }));
  };

  const acceptInvite = async (token: string) => {
    const { data, error } = await supabase.rpc("accept_space_invite", { invite_token: token });
    if (error || !data) {
      toast.error(error?.message || "Could not accept invite");
      return;
    }
    navigate(`/spaces/${data}`);
  };

  return (
    <div className="min-h-screen bg-[#F0F0F0] p-10">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight google-sans text-gray-900">Your Spaces</h1>
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

        {invites.length > 0 && (
          <div className="space-y-3 mb-8">
            {invites.map((invite) => (
              <div
                key={invite.token}
                className="flex items-center justify-between p-4 bg-white border-2 border-gray-900 rounded-xl"
              >
                <p className="text-sm text-gray-900">
                  Join <span className="font-semibold">{invite.spaceName}</span> as {invite.role}
                </p>
                <button
                  onClick={() => acceptInvite(invite.token)}
                  className="px-4 py-2 border-2 border-gray-900 rounded-xl bg-black text-white text-sm font-semibold"
                >
                  Accept
                </button>
              </div>
            ))}
          </div>
        )}

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

        <div className="space-y-4">
          {spaces.map((space) => (
            <div key={space.id} className="p-5 bg-white border-2 border-gray-900 rounded-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <button
                    onClick={() => navigate(`/spaces/${space.id}`)}
                    className="text-lg font-semibold text-gray-900 hover:underline"
                  >
                    {space.name}
                  </button>
                  <p className="text-xs uppercase tracking-wide text-gray-500 mt-1">{space.role}</p>
                </div>
              </div>

              {space.role === "owner" && (
                <div className="flex flex-wrap gap-2 mt-4">
                  <input
                    className="flex-1 min-w-40 px-3 py-2 border-2 border-gray-900 rounded-xl text-sm"
                    placeholder="Email, optional"
                    value={emailBySpace[space.id] ?? ""}
                    onChange={(e) => setEmailBySpace((current) => ({ ...current, [space.id]: e.target.value }))}
                  />
                  <select
                    className="px-3 py-2 border-2 border-gray-900 rounded-xl text-sm bg-white"
                    value={roleBySpace[space.id] ?? "editor"}
                    onChange={(e) =>
                      setRoleBySpace((current) => ({
                        ...current,
                        [space.id]: e.target.value as "editor" | "viewer",
                      }))
                    }
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    onClick={() => createInvite(space.id)}
                    className="px-4 py-2 border-2 border-gray-900 rounded-xl text-sm font-medium hover:bg-gray-100"
                  >
                    Copy invite link
                  </button>
                </div>
              )}
            </div>
          ))}

          {spaces.length === 0 && (
            <p className="text-gray-500 text-center mt-10 text-sm">You don't have any spaces yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
