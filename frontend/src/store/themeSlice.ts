import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

const THEME_STORAGE_KEY = 'theme'

const getInitialTheme = () => {
    if (typeof window === 'undefined') {
        return false
    }

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)

    if (savedTheme === 'dark') {
        return true
    }

    if (savedTheme === 'light') {
        return false
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export interface ThemeState {
    isDark: boolean
}

const initialState: ThemeState = {
    isDark: getInitialTheme(),
}

const themeSlice = createSlice({
    name: 'theme',
    initialState,
    reducers: {
        toggleTheme: (state) => {
            state.isDark = !state.isDark
        },
        setTheme: (state, action: PayloadAction<boolean>) => {
            state.isDark = action.payload
        },
    },
})

export const themeStorageKey = THEME_STORAGE_KEY
export const { setTheme, toggleTheme } = themeSlice.actions
export default themeSlice.reducer
