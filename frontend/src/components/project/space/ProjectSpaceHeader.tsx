import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { IconBadge } from '../../../shared/components'

interface ProjectSpaceHeaderProps {
    title: string
    description: string
    icon: LucideIcon
    iconColor: 'purple' | 'yellow' | 'green'
    rightContent?: ReactNode
}

export function ProjectSpaceHeader({
    title,
    description,
    icon,
    iconColor,
    rightContent,
}: ProjectSpaceHeaderProps) {
    return (
        <div className="border-default-200 flex flex-col gap-4 border-b px-6 py-3">
            <div className="flex flex-row items-center justify-between gap-4">
                <div className="flex min-w-0 flex-row items-center gap-3">
                    <div className="h-9 w-9 shrink-0">
                        <IconBadge icon={icon} color={iconColor} />
                    </div>
                    <div className="w-full min-w-0">
                        <h1 className="text-xl font-semibold">{title}</h1>
                        <p className="text-default-500 text-sm">
                            {description}
                        </p>
                    </div>
                </div>
                {rightContent ? <div className="shrink-0">{rightContent}</div> : null}
            </div>
        </div>
    )
}
