import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "./lib/supaBaseClient";
import { useAppDispatch, useAppSelector } from "./app/store";
import { setAuthState } from "./features/AuthSlice";
import AuthCallback from "./Pages/AuthCallBack";

import SpacesPage from "./Pages/SpacePage";
import CanvasPage from "./Pages/CanvasPage";
import { Hero } from "./Pages/Hero";
import InvitePage from "./Pages/InvitePage";
import { rememberInvite } from "./lib/sharing";

function AuthLoader({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const loading = useAppSelector((s) => s.auth.loading);
  if(!loading) console.log("Could not log in");
  

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      dispatch(setAuthState({ session, user: session?.user ?? null }));

      supabase.auth.onAuthStateChange((_event, session) => {
        dispatch(setAuthState({ session, user: session?.user ?? null }));
      });
    })();
  }, [dispatch]);

  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAppSelector((s) => s.auth);
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    const token = location.pathname.split("/")[2];
    if (location.pathname.startsWith("/invite/") && token) rememberInvite(token);
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthLoader>
        <Routes>
          <Route path="/" element={<Hero />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route
            path="/invite/:token"
            element={
              <ProtectedRoute>
                <InvitePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/spaces"
            element={
              <ProtectedRoute>
                <SpacesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/spaces/:spaceId"
            element={
              <ProtectedRoute>
                <CanvasPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthLoader>
    </BrowserRouter>
  );
}