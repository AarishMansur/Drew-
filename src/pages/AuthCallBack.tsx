import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAppDispatch } from "../hooks/reduxHook";
import { setAuth } from "../features/auth/authSlice";

export default function AuthCallback() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const completeRedirect = () => {
    const target = sessionStorage.getItem("postLoginRedirect");
    if (target) {
      sessionStorage.removeItem("postLoginRedirect");
      navigate(target, { replace: true });
    } else {
      navigate("/home");
    }
  };

  useEffect(() => {
    async function handleCallback() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("getSession error:", error);
          navigate("/");
          return;
        }

        if (data.session) {
          const user = data.session.user;

          const email = user.email ?? "";
          const userName =
            (user.user_metadata?.full_name as string | undefined) ||
            email.split("@")[0] ||
            "User";

          dispatch(
            setAuth({
              userId: user.id,
              userName,
              email,
            })
          );

          completeRedirect();
          return;
        }

       
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_IN" && session) {
            const user = session.user;
            const email = user.email ?? "";
            const userName =
              (user.user_metadata?.full_name as string | undefined) ||
              email.split("@")[0] ||
              "User";

            dispatch(
              setAuth({
                userId: user.id,
                userName,
                email,
              })
            );

            completeRedirect();
          }
        });

    
        return () => {
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error("Callback error:", err);
        navigate("/");
      }
    }

    handleCallback();
  }, [dispatch, navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
