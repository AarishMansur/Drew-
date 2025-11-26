import { type FormEvent, useState } from "react";
import { supabase } from "../lib/supaBaseClient";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../app/store";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const user = useAppSelector((s) => s.auth.user);
  const navigate = useNavigate();

  if (user) navigate("/spaces");

  const handleOAuth = async (provider: "google" | "github") => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin + "/auth/callback",
      },
    });
    if (error) setStatus(error.message);
  };

  const handleMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("Sending magic link...");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + "/auth/callback",
      },
    });
    if (error) setStatus(error.message);
    else setStatus("Check your email for the magic link.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="w-full max-w-md rounded-xl bg-slate-800 p-6 space-y-6">
        <h1 className="text-2xl font-bold text-center">Sign in</h1>

        <button
          onClick={() => handleOAuth("google")}
          className="w-full py-2 rounded-lg bg-red-500 hover:bg-red-600 font-semibold"
        >
          Continue with Google
        </button>

        <button
          onClick={() => handleOAuth("github")}
          className="w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 font-semibold"
        >
          Continue with GitHub
        </button>

        <div className="h-px bg-slate-600 my-2" />

        <form onSubmit={handleMagicLink} className="space-y-3">
          <label className="block text-sm">
            Email (magic link)
            <input
              type="email"
              className="mt-1 w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-blue-500 hover:bg-blue-600 font-semibold"
          >
            Send magic link
          </button>
        </form>

        {status && <p className="text-xs text-slate-300">{status}</p>}
      </div>
    </div>
  );
}
