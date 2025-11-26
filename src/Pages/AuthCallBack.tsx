import { useEffect } from "react";
import { supabase } from "../lib/supaBaseClient";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../app/store";
import { setAuthState } from "../features/AuthSlice";

export default function AuthCallback() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  useEffect(() => {
    supabase.auth.onAuthStateChange((_event, session) => {
      dispatch(setAuthState({ session, user: session?.user ?? null }));
      navigate("/spaces", { replace: true });
    });
  }, []);

  return (
    <div className="text-white h-screen flex items-center justify-center">
      Logging you in...
    </div>
  );
}
