import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Session, User } from "@supabase/supabase-js";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const initialState: AuthState = {
  session: null,
  user: null,
  loading: true,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuthState(
      state,
      action: PayloadAction<{ session: Session | null; user: User | null }>
    ) {
      state.session = action.payload.session;
      state.user = action.payload.user;
      state.loading = false;
    },
  },
});

export const { setAuthState } = authSlice.actions;
export default authSlice.reducer;
