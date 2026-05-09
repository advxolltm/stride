import type { FocusEventHandler, KeyboardEventHandler, Ref } from 'react'
import { Card } from '@heroui/react'
import { Users } from 'lucide-react'
import type { Project } from '../../store/features/project/project.types'
import getInitials from '../../shared/utils/getInitials'
import { Link } from 'react-router-dom'

interface MainPageCardProps {
    project: Project
    href: string
    linkRef?: Ref<HTMLAnchorElement>
    tabIndex?: number
    onKeyDown?: KeyboardEventHandler<HTMLAnchorElement>
    onFocus?: FocusEventHandler<HTMLAnchorElement>
}

export function MainPageCard({
    project,
    href,
    linkRef,
    tabIndex = -1,
    onKeyDown,
    onFocus,
}: MainPageCardProps) {
    return (
        <Link
            ref={linkRef}
            to={href}
            tabIndex={tabIndex}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            className="block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        >
            <Card className="border-border bg-surface h-full cursor-pointer rounded-xl border text-left transition-all hover:border-(--accent)/30 hover:shadow-md">
                <Card.Header className="flex items-start gap-4 pb-3">
                    <div className="`text-accent-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--accent) text-xs font-bold text-white">
                        {getInitials(project.name)}
                    </div>

                    <div className="w-full">
                        <Card.Title className="w-full truncate text-sm font-bold text-(--foreground)">
                            {project.name}
                        </Card.Title>
                        <Card.Description className="text-muted mt-1 line-clamp-4 w-full text-sm leading-relaxed">
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
        </Link>
    )
}
