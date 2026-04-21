import { useState } from 'react'
import { ThemeContext } from './themeContext'

interface ThemeProviderProps {
    children: React.ReactNode
}

export function ThemeProvider({ children }: Readonly<ThemeProviderProps>) {
    const [isDark, setIsDark] = useState(() => {
        return localStorage.getItem('theme') === 'dark'
    })

    const toggleTheme = () => {
        setIsDark((prev) => {
            const next = !prev
            const root = document.documentElement
            root.classList.toggle('dark', next)
            root.setAttribute('data-theme', next ? 'dark' : 'light')
            localStorage.setItem('theme', next ? 'dark' : 'light')
            return next
        })
    }

    return (
        <ThemeContext.Provider value={{ isDark, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}
