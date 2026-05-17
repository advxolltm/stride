import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AppBreadcrumb, AppHeader } from '../components/layout'
import { Sidebar } from '../components/layout/SideBar'
import { CreateProjectDialog } from '../components/project/CreateProjectDialog'

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

export function AppLayout() {
    const location = useLocation()
    const [sidebarCollapsed, setSidebarCollapsed] = useState(
        getInitialSidebarCollapsed,
    )
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const isWhiteboardRoute = location.pathname.endsWith('/whiteboard')

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
        </div>
    )
}
