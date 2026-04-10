import { Card } from '@heroui/react'
import type { ReactNode } from 'react'

interface ProjectSpaceCardProps {
    title: string
    description: string
    icon: ReactNode
    onClick?: () => void
}

export default function ProjectSpaceCard({
    title,
    description,
    icon,
    onClick,
}: Readonly<ProjectSpaceCardProps>) {
    return (
        <Card
            onClick={onClick}
            className="cursor-pointer rounded-xl border p-6 transition hover:shadow-md"
        >
            <div className="flex h-10 w-10 items-center justify-center">
                {icon}
            </div>
            <Card.Header>
                <Card.Title>{title}</Card.Title>
                <Card.Description>{description}</Card.Description>
            </Card.Header>
        </Card>
    )
}
