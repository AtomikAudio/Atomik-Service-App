import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'client' | 'technician' | 'master_technician' | 'admin';
  avatar?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;
  loading: boolean;
  initializing: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isOnboarded: false,
  loading: false,
  initializing: true,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuth: (
      state,
      action: PayloadAction<{
        user: User;
        token: string;
        isOnboarded?: boolean;
      }>
    ) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.isOnboarded =
        action.payload.isOnboarded ??
        action.payload.user.role !== 'client';
    },
    setOnboarded: (state, action: PayloadAction<boolean>) => {
      state.isOnboarded = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isOnboarded = false;
      state.initializing = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setInitializing: (state, action: PayloadAction<boolean>) => {
      state.initializing = action.payload;
    },
    restoreSession: (
      state,
      action: PayloadAction<{
        user: User;
        token: string;
        isOnboarded?: boolean;
      }>
    ) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.isOnboarded =
        action.payload.isOnboarded ??
        action.payload.user.role !== 'client';
      state.initializing = false;
    },
    sessionRestoreFailed: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      state.isOnboarded = false;
      state.initializing = false;
    },
    updateUser: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
  },
});

export const {
  setAuth,
  setOnboarded,
  logout,
  setLoading,
  setInitializing,
  restoreSession,
  sessionRestoreFailed,
  updateUser,
} = authSlice.actions;
export default authSlice.reducer;
