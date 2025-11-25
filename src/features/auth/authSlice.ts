import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  userId: string;
  userName: string;
  email: string;
  loggedIn: boolean;
}

const initialState: AuthState = {
  userId: "",
  userName: "",
  email: "",
  loggedIn: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAuth(
      state,
      action: PayloadAction<{
        userId: string;
        userName: string;
        email: string;
      }>
    ) {
      state.userId = action.payload.userId;
      state.userName = action.payload.userName;
      state.email = action.payload.email;
      state.loggedIn = true;
    },

    clearAuth(state) {
      state.userId = "";
      state.userName = "";
      state.email = "";
      state.loggedIn = false;
    },
  },
});

export const { setAuth, clearAuth } = authSlice.actions;
export default authSlice.reducer;
