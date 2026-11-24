const INVITE_KEY = "drew-invite";

export type SpaceRole = "owner" | "editor" | "viewer";

export function rememberInvite(token: string) {
  sessionStorage.setItem(INVITE_KEY, token);
}

export function consumeInvitePath() {
  const token = sessionStorage.getItem(INVITE_KEY);
  if (!token) return null;
  sessionStorage.removeItem(INVITE_KEY);
  return `/invite/${token}`;
}

export function displayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const meta = user.user_metadata?.full_name ?? user.user_metadata?.name;
  if (typeof meta === "string" && meta.trim()) return meta.trim();
  if (user.email) return user.email.split("@")[0];
  return "Someone";
}

const COLORS = ["#2563eb", "#e11d48", "#059669", "#d97706", "#7c3aed", "#0891b2"];

export function colorFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export function isMissingRelation(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205";
}

export function canEditRole(role: SpaceRole | "none" | "loading") {
  return role === "owner" || role === "editor";
}
