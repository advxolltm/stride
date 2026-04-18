import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

type AuthState = {
    isAuthenticated: boolean
}

const initialState: AuthState = {
    isAuthenticated: false,
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setAuthenticated(state, action: PayloadAction<boolean>) {
            state.isAuthenticated = action.payload
        },
        logout(state) {
            state.isAuthenticated = false
        },
        hydrateAuth(state, action: PayloadAction<boolean>) {
            state.isAuthenticated = action.payload
        },
    },
})

export const { setAuthenticated, logout, hydrateAuth } = authSlice.actions
export default authSlice.reducer
