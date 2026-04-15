import type { LucideIcon } from 'lucide-react'
import { IconBadge } from '../../../shared/components'

interface ProjectSpaceHeaderProps {
    title: string
    description: string
    icon: LucideIcon
    iconColor: 'purple' | 'yellow' | 'green'
}

export function ProjectSpaceHeader({
    title,
    description,
    icon,
    iconColor,
}: ProjectSpaceHeaderProps) {
    return (
        <div className="border-default-200 flex flex-col gap-4 border-b">
            <div className="mb-6 flex flex-row items-center gap-3">
                <div className="h-9 w-9">
                    <IconBadge icon={icon} color={iconColor} />
                </div>
                <div className="w-full">
                    <h1 className="text-xl font-semibold">{title}</h1>
                    <p className="text-default-500 text-sm">{description}</p>
                </div>
            </div>
        </div>
    )
}
