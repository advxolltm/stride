import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppBreadcrumb, AppHeader } from '../components/layout'
import { Sidebar } from '../components/layout/SideBar'
import { CreateProjectDialog } from '../components/project/CreateProjectDialog'
import { ConfirmDialog } from '../shared/components'
import { useAppDispatch } from '../shared/hooks/redux'
import { useGetSessionQuery } from '../store/features/auth/auth.api'
import {
    useGetNotificationsQuery,
    useMarkNotificationReadMutation,
    useWatchNotificationsQuery,
} from '../store/features/notification/notification.api'
import type { Notification } from '../store/features/notification/notification.types'
import { projectApi } from '../store/features/project/project.api'

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'sidebarCollapsed'
const PROJECT_REMOVAL_NOTIFICATION_PREFIX = 'You were removed from project:'

const getInitialSidebarCollapsed = () => {
    if (typeof window === 'undefined') {
        return false
    }

    try {
        return (
            window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) ===
            'true'
        )
    } catch {
        return false
    }
}

export interface AppLayoutOutletContext {
    openCreateProjectDialog: () => void
}

export function AppLayout() {
    const dispatch = useAppDispatch()
    const location = useLocation()
    const navigate = useNavigate()
    const [sidebarCollapsed, setSidebarCollapsed] = useState(
        getInitialSidebarCollapsed,
    )
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const processedRemovalNotificationIdsRef = useRef<Set<string>>(new Set())
    const { t } = useTranslation('common')
    const { data: sessionUser } = useGetSessionQuery()
    const {
        data: notifications = [],
        isSuccess: areNotificationsLoaded,
    } = useGetNotificationsQuery()
    useWatchNotificationsQuery(undefined, { skip: !areNotificationsLoaded })
    const [markNotificationRead] = useMarkNotificationReadMutation()
    const isWhiteboardRoute = location.pathname.endsWith('/whiteboard')

    const activeProjectRemovalNotification = useMemo(() => {
        return notifications
            .toReversed()
            .find(
                (notification) =>
                    !notification.read &&
                    notification.objectType === 'project' &&
                    notification.message.startsWith(
                        PROJECT_REMOVAL_NOTIFICATION_PREFIX,
                    ),
            )
    }, [notifications])

    const isViewingRemovedProject =
        !!activeProjectRemovalNotification &&
        location.pathname.startsWith(
            `/project/${activeProjectRemovalNotification.objectId}`,
        )

    const removedProjectName = activeProjectRemovalNotification
        ? activeProjectRemovalNotification.message
              .slice(PROJECT_REMOVAL_NOTIFICATION_PREFIX.length)
              .trim() || t('projectRemoval.projectFallback')
        : t('projectRemoval.projectFallback')

    const handleOpenCreateProjectDialog = () => {
        setIsCreateDialogOpen(true)
    }

    const handleToggleSidebar = () => {
        setSidebarCollapsed((prev) => {
            const next = !prev

            try {
                window.localStorage.setItem(
                    SIDEBAR_COLLAPSED_STORAGE_KEY,
                    String(next),
                )
            } catch {
                // Keep the in-memory state even when storage is unavailable.
            }

            return next
        })
    }

    useEffect(() => {
        if (!activeProjectRemovalNotification) {
            return
        }

        const notificationId = activeProjectRemovalNotification.id
        if (
            processedRemovalNotificationIdsRef.current.has(notificationId)
        ) {
            return
        }

        processedRemovalNotificationIdsRef.current.add(notificationId)

        dispatch(
            projectApi.util.updateQueryData(
                'getProjects',
                undefined,
                (draft) =>
                    draft.filter(
                        (project) =>
                            project.id !==
                            activeProjectRemovalNotification.objectId,
                    ),
            ),
        )
        dispatch(
            projectApi.util.invalidateTags([
                {
                    type: 'Project',
                    id: activeProjectRemovalNotification.objectId,
                },
                {
                    type: 'ProjectMember',
                    id: activeProjectRemovalNotification.objectId,
                },
                {
                    type: 'ProjectSkill',
                    id: activeProjectRemovalNotification.objectId,
                },
            ]),
        )
    }, [activeProjectRemovalNotification, dispatch])

    const handleProjectRemovalAcknowledge = async (
        notification: Notification,
    ) => {
        try {
            await markNotificationRead(notification.id).unwrap()
        } catch {
            // The dialog can remain open if marking the notification read fails.
            return
        }

        if (isViewingRemovedProject) {
            navigate('/', { replace: true })
        }
    }

    return (
        <div className="flex min-h-screen flex-col">
            {!isWhiteboardRoute && <AppHeader />}

            <main
                className={[
                    'flex h-screen overflow-hidden',
                    isWhiteboardRoute ? 'pt-0' : 'pt-14',
                ].join(' ')}
            >
                {!isWhiteboardRoute && (
                    <Sidebar
                        collapsed={sidebarCollapsed}
                        onToggle={handleToggleSidebar}
                        onCreateProject={handleOpenCreateProjectDialog}
                    />
                )}

                <div className="flex min-w-0 flex-1 flex-col overflow-auto bg-background">
                    {!isWhiteboardRoute && <AppBreadcrumb />}
                    <Outlet
                        context={{
                            openCreateProjectDialog:
                                handleOpenCreateProjectDialog,
                        }}
                    />
                </div>
            </main>

            <CreateProjectDialog
                isOpen={isCreateDialogOpen}
                setIsOpen={setIsCreateDialogOpen}
            />
            <ConfirmDialog
                isOpen={!!activeProjectRemovalNotification}
                onOpenChange={() => {}}
                title={t('projectRemoval.title')}
                message={t('projectRemoval.message', {
                    projectName: removedProjectName,
                })}
                confirmLabel={t('projectRemoval.confirm')}
                cancelLabel={null}
                onConfirm={async () => {
                    if (!activeProjectRemovalNotification || !sessionUser) {
                        return
                    }

                    await handleProjectRemovalAcknowledge(
                        activeProjectRemovalNotification,
                    )
                }}
            />
        </div>
    )
}
