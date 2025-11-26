import { useEffect } from "react";
import { supabase } from "./lib/supaBaseClient";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "./app/store";
import { setAuthState } from "./features/AuthSlice";

export default function AuthCallback() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getSession();
     if(error) console.log("Error :",error);
     

      if (data.session) {
        dispatch(setAuthState({ session: data.session, user: data.session.user }));
        navigate("/spaces", { replace: true });
        return;
      }

    
      supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          dispatch(setAuthState({ session, user: session.user }));
          navigate("/spaces", { replace: true });
        }
      });
    })();
  }, []);

  return (
    <div className="text-white h-screen flex items-center justify-center">
      Signing you in...
    </div>
  );
}
