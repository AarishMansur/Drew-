import { createSlice,type PayloadAction } from "@reduxjs/toolkit";
import {type DrawingState } from "../../Types/types";

const initialState:DrawingState = {
    isDrawing:false,
    shape:"square",
    userId:'',
    textEnabled:false,
}

const drawingSlice = createSlice({
    name:"draw",
    initialState,
    reducers:{
    setDrawing(state,action:PayloadAction<{userId:string,shape:string,isDrawing:boolean}>){
    state.userId = action.payload.userId;
    state.shape = action.payload.shape;
    state.isDrawing = action.payload.isDrawing;
    },
    setTextEnabled(state,action:PayloadAction<boolean>){
    state.textEnabled = action.payload;
    },
    }
})

export const {setDrawing,setTextEnabled}= drawingSlice.actions;
export default drawingSlice.reducer