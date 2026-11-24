import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import { supabase } from "../lib/supaBaseClient";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Joining space...");

  useEffect(() => {
    if (!token) return;
    let gone = false;
    (async () => {
      const { data, error } = await supabase.rpc("accept_space_invite", { invite_token: token });
      if (gone) return;
      if (error || !data) {
        const text = error?.message || "Could not accept invite";
        setMessage(text);
        toast.error(text);
        return;
      }
      navigate(`/spaces/${data}`, { replace: true });
    })();
    return () => {
      gone = true;
    };
  }, [token, navigate]);

  return (
    <div className="h-screen flex items-center justify-center bg-[#F0F0F0] text-gray-900">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" />
      <p className="text-lg font-medium">{message}</p>
    </div>
  );
}
