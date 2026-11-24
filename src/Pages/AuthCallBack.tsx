
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../app/store";
import { consumeInvitePath } from "../lib/sharing";


export default function AuthCallback() {
  const navigate = useNavigate();
  const user = useAppSelector((s) => s.auth.user);
  const sent = useRef(false);

  useEffect(() => {
    if (!user || sent.current) return;
    sent.current = true;
    navigate(consumeInvitePath() ?? "/spaces", { replace: true });
  }, [user, navigate]);

  return (
    <div className="text-white h-screen flex items-center justify-center">
      Logging you in...
    </div>
  );
}