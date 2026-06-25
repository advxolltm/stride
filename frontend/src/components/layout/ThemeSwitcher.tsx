import { Button } from '@heroui/react'
import clsx from 'clsx'
import { Moon, Sun } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../shared/hooks/redux'
import { toggleTheme } from '../../store/themeSlice'

interface ThemeSwitcherProps {
    className?: string
}

export function ThemeSwitcher({ className }: ThemeSwitcherProps) {
    const dispatch = useAppDispatch()
    const isDark = useAppSelector((state) => state.theme.isDark)

    return (
        <Button
            variant="ghost"
            isIconOnly
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            onPress={() => dispatch(toggleTheme())}
            className={clsx('transition-all', className)}
        >
            {isDark ? (
                <Sun className="h-5 w-5" />
            ) : (
                <Moon className="h-5 w-5" />
            )}
        </Button>
    )
}
