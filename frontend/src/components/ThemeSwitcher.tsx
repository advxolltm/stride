import { Button } from '@heroui/react'
import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

function ThemeSwitcher() {
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('theme')

        if (saved) return saved === 'dark'

        return window.matchMedia('(prefers-color-scheme: dark)').matches
    })

    // Apply theme when it changes
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

    return (
        <Button
            isIconOnly
            onPress={() => setIsDark((prev) => !prev)}
            className="transition-all"
        >
            {isDark ? (
                <Sun className="h-5 w-5" />
            ) : (
                <Moon className="h-5 w-5" />
            )}
        </Button>
    )
}

export default ThemeSwitcher
