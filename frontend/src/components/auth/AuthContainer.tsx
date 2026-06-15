import { Card } from '@heroui/react'
import { Zap } from 'lucide-react'

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
        <div className="flex min-h-svh items-center justify-center bg-background p-6">
            <Card className="w-full max-w-[440px] rounded-2xl border-0 px-9 py-10 shadow-[0_10px_30px_rgba(0,0,0,0.08),0_-4px_12px_rgba(0,0,0,0.04)]">
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
