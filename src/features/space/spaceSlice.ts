// features/space/spaceSlice.ts
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface Space {
  userId: string;
  spaceId: string;
  name: string;
  updatedAt: string;
  sharedLink: string;
  participants: number;
}

interface SpaceState {
  list: Space[];
  currentSpaceId: string | null;
}

const STORAGE_KEY = 'drew_spaces';

const loadSpaces = (): Space[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Space[];
  } catch {
    return [];
  }
};

const persistSpaces = (spaces: Space[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(spaces));
  } catch {
    // ignore storage errors
  }
};

const initialState: SpaceState = {
  list: loadSpaces(),
  currentSpaceId: null,
};

const spaceSlice = createSlice({
  name: "spaces",
  initialState,
  reducers: {
    addSpace(state, action: PayloadAction<Space>) {
      state.list.unshift(action.payload);
      persistSpaces(state.list);
    },
    // NEW: Handles syncing a space from a shared link into the user's list
    joinSpace(state, action: PayloadAction<{ spaceId: string; name: string }>) {
      const existing = state.list.find((s) => s.spaceId === action.payload.spaceId);
      
      if (existing) {
        // Just update the name if it changed remotely
        existing.name = action.payload.name;
      } else {
        // Add to list as a "visited/shared" space
        state.list.unshift({
          userId: "shared", // flag to show it's shared
          spaceId: action.payload.spaceId,
          name: action.payload.name,
          updatedAt: new Date().toLocaleDateString(),
          sharedLink: window.location.href,
          participants: 1
        });
      }
      persistSpaces(state.list);
    },
    deleteSpace(state, action: PayloadAction<string>) {
      state.list = state.list.filter((s) => s.spaceId !== action.payload);
      if (state.currentSpaceId === action.payload) {
        state.currentSpaceId = null;
      }
      persistSpaces(state.list);
    },
    setCurrentSpace(state, action: PayloadAction<string>) {
      state.currentSpaceId = action.payload;
    },
  },
});

export const { addSpace, joinSpace, deleteSpace, setCurrentSpace } = spaceSlice.actions;
export default spaceSlice.reducer;