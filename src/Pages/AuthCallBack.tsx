
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../app/store"; 


export default function AuthCallback() {
  const navigate = useNavigate();

  const user = useAppSelector((s) => s.auth.user); 

  useEffect(() => {

    if (user) {

      navigate("/spaces", { replace: true });
    }
  }, [user, navigate]); 

  return (
    <div className="text-white h-screen flex items-center justify-center">
      Logging you in...
    </div>
  );
}