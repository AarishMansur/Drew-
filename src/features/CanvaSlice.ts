import { createSlice, type PayloadAction } from "@reduxjs/toolkit";


export type shapeType = 'rect'  |'line' |'circle' |"arrow" |"text";

export type Shape = {
  id: string;
  spaceId: string;
  type: shapeType; 
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  points?:number[],
  text?:string,
  props?: Record<string, any>;
};

type CanvasState = {
  shapes: Record<string, Shape>; 
};

const initialState: CanvasState = {
  shapes: {},
};

const canvasSlice = createSlice({
  name: "canvas",
  initialState,
  reducers: {
    setShapes(state, action: PayloadAction<{ spaceId: string; shapes: Shape[] }>) {
      for (const id of Object.keys(state.shapes)) {
        if (state.shapes[id].spaceId === action.payload.spaceId) {
          delete state.shapes[id];
        }
      }
      for (const shape of action.payload.shapes) {
        state.shapes[shape.id] = shape;
      }
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
