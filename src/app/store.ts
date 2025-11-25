import { configureStore } from '@reduxjs/toolkit'
import spaceReducer from '../features/space/spaceSlice'
import authReducer from '../features/auth/authSlice'
import drawingReducer from '../features/drawing/drawingSlice'

export const store = configureStore({
  reducer: {
    space:spaceReducer,
    auth:authReducer,
    drawing:drawingReducer
  },
})
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch