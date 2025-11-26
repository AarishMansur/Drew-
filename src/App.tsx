import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "./lib/supaBaseClient";
import { useAppDispatch, useAppSelector } from "./app/store";
import { setAuthState } from "./features/AuthSlice";

import SpacesPage from "./Pages/SpacePage";
import CanvasPage from "./Pages/CanvasPage";
import { Hero } from "./Pages/Hero";

function AuthLoader({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();
  const loading = useAppSelector((s) => s.auth.loading);

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

  if (loading) return <div className="flex h-screen items-center justify-center bg-white">Loading...</div>;
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAppSelector((s) => s.auth.user);
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthLoader>
        <Routes>
          <Route path="/" element={<Hero />} />
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