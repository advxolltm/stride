import type { FocusEventHandler, KeyboardEventHandler, Ref } from 'react'
import { useState } from 'react'
import { Button, Card, Chip, Dropdown, Label, toast } from '@heroui/react'
import {
    Archive,
    ArchiveRestore,
    MoreHorizontal,
    Pencil,
    Trash2,
    Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Project } from '../../store/features/project/project.types'
import getInitials from '../../shared/utils/getInitials'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from '../../shared/components'
import {
    useDeleteProjectMutation,
    useUpdateProjectMutation,
} from '../../store/features/project/project.api'
import { EditProjectDialog } from '../project/EditProjectDialog'

interface MainPageCardProps {
    project: Project
    href: string
    isOwner: boolean
    linkRef?: Ref<HTMLAnchorElement>
    tabIndex?: number
    onKeyDown?: KeyboardEventHandler<HTMLAnchorElement>
    onFocus?: FocusEventHandler<HTMLAnchorElement>
}

export function MainPageCard({
    project,
    href,
    isOwner,
    linkRef,
    tabIndex = -1,
    onKeyDown,
    onFocus,
}: MainPageCardProps) {
    const { t } = useTranslation('project')
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const isArchived = project.status === 'archived'
    const [updateProject, { isLoading: isArchiving }] =
        useUpdateProjectMutation()
    const [deleteProject, { isLoading: isDeleting }] =
        useDeleteProjectMutation()
    const statusActionLabel = t(
        isArchived ? 'projectCard.unarchive' : 'projectCard.archive',
    )
    const statusConfirmTitle = t(
        isArchived
            ? 'projectCard.unarchiveConfirmTitle'
            : 'projectCard.archiveConfirmTitle',
    )
    const statusConfirmMessage = t(
        isArchived
            ? 'projectCard.unarchiveConfirmMessage'
            : 'projectCard.archiveConfirmMessage',
        { name: project.name },
    )
    const statusConfirmLabel = t(
        isArchived
            ? 'projectCard.unarchiveConfirm'
            : 'projectCard.archiveConfirm',
    )
    const statusConfirmPendingLabel = t(
        isArchived
            ? 'projectCard.unarchiveConfirmPending'
            : 'projectCard.archiveConfirmPending',
    )

    const handleProjectStatusChange = async () => {
        const nextStatus = isArchived ? 'active' : 'archived'

        try {
            await updateProject({
                projectId: project.id,
                body: {
                    status: nextStatus,
                },
            }).unwrap()
            toast.success(
                t(
                    isArchived
                        ? 'projectCard.unarchiveSuccess'
                        : 'projectCard.archiveSuccess',
                ),
            )
        } catch {
            toast.danger(
                t(
                    isArchived
                        ? 'projectCard.unarchiveError'
                        : 'projectCard.archiveError',
                ),
            )
        }
    }

    const handleDeleteProject = async () => {
        try {
            await deleteProject(project.id).unwrap()
            toast.success(t('generalSettings.deleteSuccess'))
        } catch {
            toast.danger(t('generalSettings.deleteError'))
        }
    }

    return (
        <div className="relative h-full rounded-xl">
            <Link
                ref={linkRef}
                to={href}
                tabIndex={tabIndex}
                onKeyDown={onKeyDown}
                onFocus={onFocus}
                className="block h-full rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--accent)"
            >
                <Card className="border-border bg-surface h-full cursor-pointer rounded-xl border text-left transition-all hover:border-(--accent)/30 hover:shadow-md">
                    <Card.Header className="flex items-start gap-4 pr-12 pb-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-(--accent) text-xs font-bold text-white">
                            {getInitials(project.name)}
                        </div>

                        <div className="w-full min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                                <Card.Title className="min-w-0 truncate text-sm font-bold text-(--foreground)">
                                    {project.name}
                                </Card.Title>
                                {isArchived && (
                                    <Chip
                                        size="sm"
                                        variant="soft"
                                        className="shrink-0"
                                    >
                                        {t('projectCard.archived')}
                                    </Chip>
                                )}
                            </div>
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

            {isOwner && (
                <div className="absolute top-3 right-3 z-10">
                    <Dropdown>
                        <Button
                            aria-label={t('projectCard.actionsMenu')}
                            variant="ghost"
                            size="sm"
                            className="text-muted hover:bg-surface-secondary h-8 w-8 min-w-0 rounded-lg p-0 hover:text-(--foreground)"
                        >
                            <MoreHorizontal size={16} />
                        </Button>

                        <Dropdown.Popover>
                            <Dropdown.Menu
                                aria-label={t('projectCard.actionsMenu')}
                                onAction={(key) => {
                                    if (key === 'edit') {
                                        setIsEditDialogOpen(true)
                                    }
                                    if (key === 'status') {
                                        setIsArchiveDialogOpen(true)
                                    }
                                    if (key === 'delete') {
                                        setIsDeleteDialogOpen(true)
                                    }
                                }}
                            >
                                <Dropdown.Item
                                    id="edit"
                                    textValue={t('projectCard.edit')}
                                >
                                    <div className="flex items-center gap-2">
                                        <Pencil size={15} />
                                        <Label>{t('projectCard.edit')}</Label>
                                    </div>
                                </Dropdown.Item>

                                <Dropdown.Item
                                    id="status"
                                    textValue={statusActionLabel}
                                >
                                    <div className="flex items-center gap-2">
                                        {isArchived ? (
                                            <ArchiveRestore size={15} />
                                        ) : (
                                            <Archive size={15} />
                                        )}
                                        <Label>{statusActionLabel}</Label>
                                    </div>
                                </Dropdown.Item>

                                <Dropdown.Item
                                    id="delete"
                                    textValue={t('projectCard.delete')}
                                    variant="danger"
                                >
                                    <div className="flex items-center gap-2">
                                        <Trash2 color="red" size={15} />
                                        <Label>{t('projectCard.delete')}</Label>
                                    </div>
                                </Dropdown.Item>
                            </Dropdown.Menu>
                        </Dropdown.Popover>
                    </Dropdown>
                </div>
            )}
            <EditProjectDialog
                key={`${project.id}-${project.updatedAt}`}
                isOpen={isEditDialogOpen}
                setIsOpen={setIsEditDialogOpen}
                project={project}
            />

            <ConfirmDialog
                isOpen={isArchiveDialogOpen}
                onOpenChange={setIsArchiveDialogOpen}
                title={statusConfirmTitle}
                message={statusConfirmMessage}
                confirmLabel={statusConfirmLabel}
                pendingConfirmLabel={statusConfirmPendingLabel}
                cancelLabel={t('generalSettings.deleteCancel')}
                isConfirmPending={isArchiving}
                onConfirm={handleProjectStatusChange}
            />

            <ConfirmDialog
                isOpen={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                title={t('generalSettings.deleteConfirmTitle')}
                message={t('generalSettings.deleteConfirmMessage', {
                    name: project.name,
                })}
                confirmLabel={t('generalSettings.deleteConfirm')}
                cancelLabel={t('generalSettings.deleteCancel')}
                confirmVariant="danger"
                isConfirmPending={isDeleting}
                onConfirm={handleDeleteProject}
            />
        </div>
    )
}
