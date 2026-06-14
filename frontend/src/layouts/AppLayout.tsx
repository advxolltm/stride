import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppBreadcrumb, AppHeader } from '../components/layout'
import { Sidebar } from '../components/layout/SideBar'
import { CreateProjectDialog } from '../components/project/CreateProjectDialog'
import { ConfirmDialog } from '../shared/components'
import { useAppDispatch } from '../shared/hooks/redux'
import {
    getProjectLifecycleNotificationKind,
    getProjectLifecycleNotificationProjectName,
    shouldRedirectHomeAfterLifecycleAcknowledge,
} from '../shared/utils/notificationBehavior'
import {
    useGetNotificationsQuery,
    useMarkNotificationReadMutation,
    useWatchNotificationsQuery,
} from '../store/features/notification/notification.api'
import type { Notification } from '../store/features/notification/notification.types'
import { projectApi } from '../store/features/project/project.api'

const SIDEBAR_COLLAPSED_STORAGE_KEY = 'sidebarCollapsed'

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

const patchProjectStatusInCaches = (
    dispatch: ReturnType<typeof useAppDispatch>,
    projectId: string,
    status: 'active' | 'archived',
) => {
    dispatch(
        projectApi.util.updateQueryData('getProjects', undefined, (draft) => {
            const project = draft.find((item) => item.id === projectId)
            if (project) {
                project.status = status
            }
        }),
    )
    dispatch(
        projectApi.util.updateQueryData('getProjectById', projectId, (draft) => {
            draft.status = status
        }),
    )
}

const removeProjectFromProjectListCache = (
    dispatch: ReturnType<typeof useAppDispatch>,
    projectId: string,
) => {
    dispatch(
        projectApi.util.updateQueryData('getProjects', undefined, (draft) =>
            draft.filter((project) => project.id !== projectId),
        ),
    )
}

export function AppLayout() {
    const dispatch = useAppDispatch()
    const location = useLocation()
    const navigate = useNavigate()
    const [sidebarCollapsed, setSidebarCollapsed] = useState(
        getInitialSidebarCollapsed,
    )
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const processedLifecycleNotificationIdsRef = useRef<Set<string>>(
        new Set(),
    )
    const { t } = useTranslation('common')
    const { data: notifications = [] } = useGetNotificationsQuery()
    useWatchNotificationsQuery()
    const [markNotificationRead] = useMarkNotificationReadMutation()
    const isWhiteboardRoute = location.pathname.endsWith('/whiteboard')

    const activeProjectLifecycleNotification = useMemo(() => {
        return notifications
            .toReversed()
            .find(
                (notification) =>
                    !notification.read &&
                    getProjectLifecycleNotificationKind(notification) !== null,
            )
    }, [notifications])

    const activeProjectLifecycleKind = activeProjectLifecycleNotification
        ? getProjectLifecycleNotificationKind(activeProjectLifecycleNotification)
        : null

    const isViewingAffectedProject =
        !!activeProjectLifecycleNotification &&
        location.pathname.startsWith(
            `/project/${activeProjectLifecycleNotification.objectId}`,
        )

    const lifecycleProjectName = activeProjectLifecycleNotification
        ? getProjectLifecycleNotificationProjectName(
              activeProjectLifecycleNotification,
          ) || t('projectRemoval.projectFallback')
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
        if (!activeProjectLifecycleNotification) {
            return
        }

        const notificationId = activeProjectLifecycleNotification.id
        if (processedLifecycleNotificationIdsRef.current.has(notificationId)) {
            return
        }

        processedLifecycleNotificationIdsRef.current.add(notificationId)

        if (!activeProjectLifecycleKind) {
            return
        }

        if (
            activeProjectLifecycleKind === 'archived' ||
            activeProjectLifecycleKind === 'unarchived'
        ) {
            patchProjectStatusInCaches(
                dispatch,
                activeProjectLifecycleNotification.objectId,
                activeProjectLifecycleKind === 'archived'
                    ? 'archived'
                    : 'active',
            )
            return
        }

        removeProjectFromProjectListCache(
            dispatch,
            activeProjectLifecycleNotification.objectId,
        )
    }, [activeProjectLifecycleKind, activeProjectLifecycleNotification, dispatch])

    const handleProjectLifecycleAcknowledge = async (
        notification: Notification,
    ) => {
        try {
            await markNotificationRead(notification.id).unwrap()
        } catch {
            // The dialog can remain open if marking the notification read fails.
            return
        }

        const lifecycleKind = getProjectLifecycleNotificationKind(notification)
        if (
            lifecycleKind &&
            isViewingAffectedProject &&
            shouldRedirectHomeAfterLifecycleAcknowledge(lifecycleKind)
        ) {
            navigate('/', { replace: true })
        }
    }

    const lifecycleDialogTitleKey =
        activeProjectLifecycleKind === 'archived'
            ? 'projectArchived.title'
            : activeProjectLifecycleKind === 'unarchived'
              ? 'projectUnarchived.title'
            : activeProjectLifecycleKind === 'deleted'
              ? 'projectDeleted.title'
              : 'projectRemoval.title'
    const lifecycleDialogMessageKey =
        activeProjectLifecycleKind === 'archived'
            ? 'projectArchived.message'
            : activeProjectLifecycleKind === 'unarchived'
              ? 'projectUnarchived.message'
            : activeProjectLifecycleKind === 'deleted'
              ? 'projectDeleted.message'
              : 'projectRemoval.message'
    const lifecycleDialogConfirmKey =
        activeProjectLifecycleKind === 'archived'
            ? 'projectArchived.confirm'
            : activeProjectLifecycleKind === 'unarchived'
              ? 'projectUnarchived.confirm'
            : activeProjectLifecycleKind === 'deleted'
              ? 'projectDeleted.confirm'
              : 'projectRemoval.confirm'

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
                isOpen={!!activeProjectLifecycleNotification}
                onOpenChange={() => {}}
                title={t(lifecycleDialogTitleKey)}
                message={t(lifecycleDialogMessageKey, {
                    projectName: lifecycleProjectName,
                })}
                confirmLabel={t(lifecycleDialogConfirmKey)}
                cancelLabel={null}
                onConfirm={async () => {
                    if (!activeProjectLifecycleNotification) {
                        return
                    }

                    await handleProjectLifecycleAcknowledge(
                        activeProjectLifecycleNotification,
                    )
                }}
            />
        </div>
    )
}
