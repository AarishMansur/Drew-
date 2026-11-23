import { configureStore, combineReducers } from "@reduxjs/toolkit";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import storage from "redux-persist/lib/storage";
import {
  persistStore,
  persistReducer,
} from "redux-persist";
import canvasReducer from "../features/CanvaSlice";
import authReducer from "../features/AuthSlice";

const rootReducer = combineReducers({
  canvas: canvasReducer,
  auth: authReducer,
});

const persistConfig = {
  key: "root",
  storage,
  whitelist: ["canvas"], 
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
