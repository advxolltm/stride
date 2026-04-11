import { Card } from '@heroui/react'
import { Users } from 'lucide-react'

interface MainPageCardProject {
    id: string
    initials: string
    name: string
    description: string
    members: number
}

interface MainPageCardProps {
    project: MainPageCardProject
    onClick?: () => void
}

export function MainPageCard({ project, onClick }: MainPageCardProps) {
    const isInteractive = Boolean(onClick)

    return (
        <Card
            role={isInteractive ? 'button' : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            onClick={onClick}
            onKeyDown={
                isInteractive
                    ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              onClick?.()
                          }
                      }
                    : undefined
            }
            className={`border border-[var(--border)] bg-[var(--surface)] text-left transition-all ${
                isInteractive
                    ? 'cursor-pointer hover:border-[var(--accent)]/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]'
                    : 'hover:border-[var(--accent)]/30 hover:shadow-md'
            }`}
        >
            <Card.Header className="flex items-start gap-4 pb-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)] text-xs font-bold text-[var(--accent-foreground)]">
                    {project.initials}
                </div>

                <div className="min-w-0">
                    <Card.Title className="text-sm font-bold text-[var(--foreground)]">
                        {project.name}
                    </Card.Title>
                    <Card.Description className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                        {project.description}
                    </Card.Description>
                </div>
            </Card.Header>

            <Card.Content />

            <Card.Footer className="border-t border-[var(--border)] px-2 py-3">
                <div className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
                    <Users size={13} />
                    <span>{project.members} members</span>
                </div>
            </Card.Footer>
        </Card>
    )
}
