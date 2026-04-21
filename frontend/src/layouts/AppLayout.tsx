import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppBreadcrumb, AppHeader } from '../components/layout'
import { Sidebar } from '../components/layout/SideBar'
import { CreateProjectDialog } from '../components/project/CreateProjectDialog'

export interface AppLayoutOutletContext {
    openCreateProjectDialog: () => void
}

export function AppLayout() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

    const handleOpenCreateProjectDialog = () => {
        setIsCreateDialogOpen(true)
    }

    return (
        <div className="flex min-h-screen flex-col">
            <AppHeader />

            <main className="flex h-screen overflow-hidden pt-14">
                <Sidebar
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed((prev) => !prev)}
                    onCreateProject={handleOpenCreateProjectDialog}
                />

                <div className="flex min-w-0 flex-1 flex-col overflow-auto bg-[var(--background)]">
                    <AppBreadcrumb />
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
