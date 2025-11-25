import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type Shape = {
  id: string;
  spaceId: string;
  type: "rect"; // expand later
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  props?: Record<string, any>;
};

type CanvasState = {
  shapes: Record<string, Shape>; // id -> shape
};

const initialState: CanvasState = {
  shapes: {},
};

const canvasSlice = createSlice({
  name: "canvas",
  initialState,
  reducers: {
    setShapes(state, action: PayloadAction<Shape[]>) {
      state.shapes = {};
      for (const s of action.payload) state.shapes[s.id] = s;
    },
    upsertShape(state, action: PayloadAction<Shape>) {
      state.shapes[action.payload.id] = action.payload;
    },
    removeShape(state, action: PayloadAction<string>) {
      delete state.shapes[action.payload];
    },
  },
});

export const { setShapes, upsertShape, removeShape } = canvasSlice.actions;
export default canvasSlice.reducer;
