import { createListenerMiddleware, isAnyOf } from '@reduxjs/toolkit'
import { setTheme, themeStorageKey, toggleTheme } from '../themeSlice'

type ThemeStateShape = {
    theme: {
        isDark: boolean
    }
}

const applyTheme = (isDark: boolean) => {
    if (typeof document !== 'undefined') {
        const root = document.documentElement

        root.classList.toggle('dark', isDark)
        root.setAttribute('data-theme', isDark ? 'dark' : 'light')
    }

    if (typeof window !== 'undefined') {
        window.localStorage.setItem(themeStorageKey, isDark ? 'dark' : 'light')
    }
}

export const themeListener = createListenerMiddleware()

themeListener.startListening({
    matcher: isAnyOf(toggleTheme, setTheme),
    effect: async (_, listenerApi) => {
        const state = listenerApi.getState() as ThemeStateShape

        applyTheme(state.theme.isDark)
    },
})

export const syncThemeWithDocument = (isDark: boolean) => {
    applyTheme(isDark)
}