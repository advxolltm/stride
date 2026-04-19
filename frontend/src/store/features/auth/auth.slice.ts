import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { AuthState } from './auth.types'

const initialState: AuthState = {
    isAuthenticated: false,
    isInitialized: false,
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setAuthenticated(state, action: PayloadAction<boolean>) {
            state.isAuthenticated = action.payload
            state.isInitialized = true
        },
        logout(state) {
            state.isAuthenticated = false
            state.isInitialized = true
        },
        resolveAuth(state, action: PayloadAction<boolean>) {
            state.isAuthenticated = action.payload
            state.isInitialized = true
        },
    },
})

export const { setAuthenticated, logout, resolveAuth } = authSlice.actions
export default authSlice.reducer
