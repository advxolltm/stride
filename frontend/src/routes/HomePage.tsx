import { Button } from '@heroui/react'
import ThemeSwitcher from '../components/ThemeSwitcher'

function HomePage() {
    return (
        <div className="bg-background text-foreground min-h-screen p-6 transition-colors">
            <div className="mx-auto max-w-xl space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Theme Test</h1>
                    <ThemeSwitcher />
                </div>

                <div className="rounded-base border-border bg-surface border p-4">
                    <h2 className="text-lg font-semibold">Card</h2>
                    <p className="text-muted">
                        This should adapt to light and dark mode.
                    </p>
                </div>

                <div className="flex gap-3">
                    <Button>Primary</Button>
                    <Button>Danger</Button>
                </div>

                <div className="rounded-base bg-primary text-primary-foreground p-3">
                    Tailwind + theme working
                </div>
            </div>
        </div>
    )
}

export default HomePage
