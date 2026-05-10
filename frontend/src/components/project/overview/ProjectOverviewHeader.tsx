import { Button, Chip } from '@heroui/react'
import { Settings, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Link } from 'react-router-dom'
import { useAppSelector } from '../../../shared/hooks/redux'
import type { Project } from '../../../store/features/project/project.types'
import { selectUserId } from '../../../store/userSlice'
import { ProjectSettingsModal } from '../settings/ProjectSettingsModal'
import { AddMembersDialog } from './addMembersDialog/AddMembersDialog'

interface ProjectOverviewHeaderProps {
    project: Project
}

export function ProjectOverviewHeader({
    project,
}: Readonly<ProjectOverviewHeaderProps>) {
    const { t } = useTranslation('project')
    const [isInviteOpen, setIsInviteOpen] = useState(false)
    const [isSettingsOpen, setSettingsOpen] = useState(false)

    const userId = useAppSelector(selectUserId)

    const existingMemberIds = project.members.map((m) => m.userId)
    const isOwner = project.creator?.id === userId

    return (
        <>
            <div className="border-b">
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-muted">
                            {t('header.projects')}
                        </span>
                        <div className="flex flex-row items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">
                                {project.name}
                            </h1>
                            {project.status === 'archived' && (
                                <Chip
                                    size="sm"
                                    variant="soft"
                                    className="shrink-0"
                                >
                                    {t('projectCard.archived')}
                                </Chip>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {isOwner && (
                            <Button
                                onPress={() => setIsInviteOpen(true)}
                                className="flex items-center gap-2"
                            >
                                <UserPlus size={16} />
                                {t('header.add')}
                            </Button>
                        )}

                        <div className="flex flex-row gap-2">
                            <Link to="ws-test">
                                <Button>Go to whiteboard test page</Button>
                            </Link>
                            <Button
                                onPress={() => setSettingsOpen(true)}
                                isIconOnly
                            >
                                <Settings color="white" size={18} />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <AddMembersDialog
                isOpen={isInviteOpen}
                setIsOpen={setIsInviteOpen}
                projectId={project.id}
                projectName={project.name}
                existingMemberIds={existingMemberIds}
                currentUserId={userId ?? ''}
            />

            <ProjectSettingsModal
                isOpen={isSettingsOpen}
                setIsOpen={setSettingsOpen}
                isOwner={isOwner}
                project={project}
            />
        </>
    )
}
