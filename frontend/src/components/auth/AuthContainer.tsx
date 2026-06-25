import { Card } from '@heroui/react'
import { Zap } from 'lucide-react'
import { LanguageSwitcher } from '../layout/LanguageSwitcher'
import { ThemeSwitcher } from '../layout/ThemeSwitcher'

interface AuthContainerProps {
    heading: string
    subheading: string
    footer: React.ReactNode
    children: React.ReactNode
}

export default function AuthContainer({
    heading,
    subheading,
    footer,
    children,
}: AuthContainerProps) {
    return (
        <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[var(--background)] p-3 pt-20 sm:p-6">
            <div className="absolute top-4 right-4 flex items-center gap-2 sm:top-6 sm:right-6">
                <LanguageSwitcher className="h-10 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 text-xs font-semibold shadow-[0_10px_24px_rgba(0,0,0,0.07)] backdrop-blur hover:bg-[var(--surface-secondary)] focus:ring-1 sm:text-sm" />
                <ThemeSwitcher className="h-10 w-10 min-w-10 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 text-[var(--foreground)] shadow-[0_10px_24px_rgba(0,0,0,0.07)] backdrop-blur hover:bg-[var(--surface-secondary)]" />
            </div>
            <Card className="w-full max-w-[440px] rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-6 shadow-[0_18px_50px_rgba(0,0,0,0.10),0_-4px_14px_rgba(0,0,0,0.04)] sm:px-9 sm:py-10">
                <div className="flex flex-col items-center">
                    <div className="mb-4 flex items-center gap-2.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.6rem] bg-[var(--accent)]">
                            <Zap
                                size={20}
                                strokeWidth={2}
                                color="white"
                                fill="none"
                            />
                        </div>
                        <span className="text-[30px] leading-none font-bold tracking-[0.16em] text-[var(--foreground)]">
                            STRIDE
                        </span>
                    </div>
                    <Card.Header className="mb-6 flex flex-col items-center gap-1 p-0">
                        <Card.Title className="text-center text-xl font-semibold text-[var(--foreground)]">
                            {heading}
                        </Card.Title>
                        <Card.Description className="text-center text-sm text-[var(--muted)]">
                            {subheading}
                        </Card.Description>
                    </Card.Header>
                    {children}
                    {footer ? (
                        <Card.Footer className="mt-5 justify-center p-0">
                            <p className="text-center text-sm text-[var(--muted)]">
                                {footer}
                            </p>
                        </Card.Footer>
                    ) : null}
                </div>
            </Card>
        </div>
    )
}
