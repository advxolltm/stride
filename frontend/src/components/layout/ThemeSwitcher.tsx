import { Button } from '@heroui/react'
import { Moon, Sun } from 'lucide-react'
import { useAppDispatch, useAppSelector } from '../../shared/hooks/redux'
import { toggleTheme } from '../../store/themeSlice'

export function ThemeSwitcher() {
    const dispatch = useAppDispatch()
    const isDark = useAppSelector((state) => state.theme.isDark)

    return (
        <Button
            variant="ghost"
            isIconOnly
            onPress={() => dispatch(toggleTheme())}
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
