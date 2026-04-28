import { Card } from '@heroui/react'
import { Users } from 'lucide-react'
import type { Project } from '../../store/features/project/project.types'
import getInitials from '../../shared/utils/getInitials'

interface MainPageCardProps {
    project: Project
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
            className={`border-border bg-surface border text-left transition-all ${
                isInteractive
                    ? 'cursor-pointer hover:border-(--accent)/30 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)'
                    : 'hover:border-(--accent)/30 hover:shadow-md'
            }`}
        >
            <Card.Header className="flex items-start gap-4 pb-3">
                <div className="`text-accent-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--accent) text-xs font-bold text-white">
                    {getInitials(project.name)}
                </div>

                <div className="min-w-0">
                    <Card.Title className="text-sm font-bold text-(--foreground)">
                        {project.name}
                    </Card.Title>
                    <Card.Description className="text-muted mt-1 text-sm leading-relaxed">
                        {project.description}
                    </Card.Description>
                </div>
            </Card.Header>

            <Card.Content />

            <Card.Footer className="border-border border-t px-2 py-3">
                <div className="text-muted flex items-center gap-1.5 text-xs">
                    <Users size={13} />
                    <span>{project.members.length} members</span>
                </div>
            </Card.Footer>
        </Card>
    )
}
