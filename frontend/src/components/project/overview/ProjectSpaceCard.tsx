import { Card } from '@heroui/react'
import type {
    FocusEventHandler,
    KeyboardEventHandler,
    ReactNode,
    Ref,
} from 'react'
import { Link } from 'react-router-dom'

interface ProjectSpaceCardProps {
    title: string
    description: string
    icon: ReactNode
    href: string
    linkRef?: Ref<HTMLAnchorElement>
    tabIndex?: number
    onKeyDown?: KeyboardEventHandler<HTMLAnchorElement>
    onFocus?: FocusEventHandler<HTMLAnchorElement>
}

export default function ProjectSpaceCard({
    title,
    description,
    icon,
    href,
    linkRef,
    tabIndex = -1,
    onKeyDown,
    onFocus,
}: Readonly<ProjectSpaceCardProps>) {
    return (
        <Link
            ref={linkRef}
            to={href}
            tabIndex={tabIndex}
            onKeyDown={onKeyDown}
            onFocus={onFocus}
            className="block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
        >
            <Card className="h-full cursor-pointer rounded-xl border p-6 transition hover:shadow-md">
                <div className="flex h-10 w-10 items-center justify-center">
                    {icon}
                </div>
                <Card.Header>
                    <Card.Title>{title}</Card.Title>
                    <Card.Description>{description}</Card.Description>
                </Card.Header>
            </Card>
        </Link>
    )
}
