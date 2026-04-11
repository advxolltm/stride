import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppHeader } from '../components/layout'
import { Sidebar } from '../components/layout/SideBar'

export function AppLayout() {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

    return (
        <div className="flex min-h-screen flex-col">
            <AppHeader />

            <main className="flex h-screen overflow-hidden pt-14">
                <Sidebar
                    collapsed={sidebarCollapsed}
                    onToggle={() => setSidebarCollapsed((prev) => !prev)}
                />

                <div className="flex min-w-0 flex-1 flex-col overflow-auto bg-[var(--background)]">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
