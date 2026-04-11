import { Button } from '@heroui/react'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'
import { IconBadge } from '../../../shared/components'

interface ProjectSpaceHeaderProps {
    title: string
    description: string
    icon: LucideIcon
    iconColor: 'purple' | 'yellow' | 'green'
    projectName: string
}

export function ProjectSpaceHeader({
    title,
    description,
    icon,
    iconColor,
    projectName,
}: ProjectSpaceHeaderProps) {
    const navigate = useNavigate()
    const { projectId } = useParams()

    return (
        <div className="border-default-200 flex flex-col gap-4 border-b">
            <div className="flex flex-row items-center gap-2">
                <Button
                    variant="ghost"
                    size="sm"
                    onPress={() => navigate(`/project/${projectId}`)}
                    className="text-default-500 hover:text-default-800 flex min-w-0 flex-row gap-3 px-2"
                >
                    <ArrowLeft size={13} />
                    Spaces
                </Button>

                <ChevronRight size={13} className="text-default-300" />

                <span className="text-default-500 text-sm">{projectName}</span>

                <ChevronRight size={13} className="text-default-300" />

                <span className="text-default-800 text-sm font-medium">
                    {title}
                </span>
            </div>

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
