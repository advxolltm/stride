import { useEffect, useState } from 'react'
import { ThemeContext } from './themeContext'

interface ThemeProviderProps {
    children: React.ReactNode
}

export function ThemeProvider({ children }: Readonly<ThemeProviderProps>) {
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('theme')
        return saved ? saved === 'dark' : false
    })

    useEffect(() => {
        const root = document.documentElement
        if (isDark) {
            root.classList.add('dark')
            root.setAttribute('data-theme', 'dark')
            localStorage.setItem('theme', 'dark')
        } else {
            root.classList.remove('dark')
            root.setAttribute('data-theme', 'light')
            localStorage.setItem('theme', 'light')
        }
    }, [isDark])

    const contextValue = {
        isDark,
        toggleTheme: () => setIsDark((prev) => !prev),
    }

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    )
}
